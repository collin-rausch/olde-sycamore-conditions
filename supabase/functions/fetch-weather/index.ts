import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_LAT = 35.2271
const DEFAULT_LON = -80.8431

const WEATHER_CODES: Record<number, { text: string; icon: string }> = {
  0: { text: 'Clear sky', icon: '☀️' },
  1: { text: 'Mainly clear', icon: '🌤️' },
  2: { text: 'Partly cloudy', icon: '⛅' },
  3: { text: 'Overcast', icon: '☁️' },
  45: { text: 'Fog', icon: '🌫️' },
  48: { text: 'Depositing rime fog', icon: '🌫️' },
  51: { text: 'Light drizzle', icon: '🌦️' },
  53: { text: 'Moderate drizzle', icon: '🌦️' },
  55: { text: 'Dense drizzle', icon: '🌦️' },
  61: { text: 'Slight rain', icon: '🌧️' },
  63: { text: 'Moderate rain', icon: '🌧️' },
  65: { text: 'Heavy rain', icon: '🌧️' },
  71: { text: 'Slight snow', icon: '🌨️' },
  73: { text: 'Moderate snow', icon: '🌨️' },
  75: { text: 'Heavy snow', icon: '🌨️' },
  77: { text: 'Snow grains', icon: '🌨️' },
  80: { text: 'Slight rain showers', icon: '🌦️' },
  81: { text: 'Moderate rain showers', icon: '🌦️' },
  82: { text: 'Violent rain showers', icon: '🌦️' },
  85: { text: 'Slight snow showers', icon: '🌨️' },
  86: { text: 'Heavy snow showers', icon: '🌨️' },
  95: { text: 'Thunderstorm', icon: '⛈️' },
  96: { text: 'Thunderstorm with hail', icon: '⛈️' },
  99: { text: 'Heavy thunderstorm with hail', icon: '⛈️' },
}

/** WeatherAPI.com condition.code → WMO-style codes used by Player / weatherVisuals. */
const WEATHERAPI_TO_WMO: Record<number, number> = {
  1000: 0,
  1003: 2,
  1006: 3,
  1009: 3,
  1030: 45,
  1063: 61,
  1180: 61,
  1183: 61,
  1186: 63,
  1189: 63,
  1192: 65,
  1195: 65,
  1087: 95,
  1273: 95,
  1276: 95,
}

function mapWeatherApiConditionCode(code: number): number {
  return WEATHERAPI_TO_WMO[code] ?? 2
}

function wmoMapping(code: number) {
  return WEATHER_CODES[code] || { text: 'Unknown', icon: '❓' }
}

/** US Eastern offset for TIMESTAMPTZ (simplified DST: EDT Mar–Nov). */
function easternOffsetForDate(dateYmd: string): string {
  const month = parseInt(dateYmd.slice(5, 7), 10)
  return month >= 3 && month <= 11 ? '-04:00' : '-05:00'
}

/** WeatherAPI hour time "YYYY-MM-DD HH:mm" → ISO TIMESTAMPTZ. */
function weatherApiHourToIso(localTime: string): string {
  const trimmed = localTime.trim()
  const [datePart, clockPart] = trimmed.split(' ')
  if (!datePart || !clockPart) return trimmed
  const timePart = clockPart.length === 5 ? `${clockPart}:00` : clockPart
  return `${datePart}T${timePart}${easternOffsetForDate(datePart)}`
}

/** WeatherAPI astro "6:45 AM" on forecast day → ISO TIMESTAMPTZ. */
function astroToTimestamptz(dateYmd: string, time12h: string): string | null {
  if (!dateYmd || !time12h) return null
  const match = time12h.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null

  let hour = parseInt(match[1], 10)
  const minute = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0

  const hh = String(hour).padStart(2, '0')
  const offset = easternOffsetForDate(dateYmd)
  return `${dateYmd}T${hh}:${minute}:00${offset}`
}

interface WeatherApiHour {
  time: string
  time_epoch?: number
  temp_f: number
  chance_of_rain: number
  wind_mph: number
  condition: { code: number }
}

interface WeatherApiForecastResponse {
  location?: { tz_id?: string }
  current: {
    temp_f: number
    feelslike_f: number
    humidity: number
    wind_mph: number
    wind_degree: number
    cloud: number
    uv: number
    is_day: 0 | 1
    last_updated_epoch?: number
    condition: { text: string; code: number }
  }
  forecast: {
    forecastday: Array<{
      date: string
      day: { daily_chance_of_rain: number }
      astro: { sunrise: string; sunset: string }
      hour: WeatherApiHour[]
    }>
  }
  error?: { code: number; message: string }
}

function buildHourlyForecast(hours: WeatherApiHour[], referenceEpochSec: number) {
  const upcoming = hours
    .filter((h) => (h.time_epoch ?? 0) >= referenceEpochSec - 1800)
    .slice(0, 6)

  return {
    time: upcoming.map((h) => weatherApiHourToIso(h.time)),
    temperature: upcoming.map((h) => h.temp_f),
    precip_probability: upcoming.map((h) => h.chance_of_rain),
    weather_code: upcoming.map((h) => mapWeatherApiConditionCode(h.condition.code)),
    wind_speed: upcoming.map((h) => h.wind_mph),
  }
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const weatherApiKey = Deno.env.get('WEATHERAPI_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!weatherApiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing WEATHERAPI_KEY environment variable' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })

    // Coordinates come from club_settings (set when admin publishes location).
    // Each cron run reads the latest row so weather follows the published course location.
    const { data: settings } = await supabase
      .from('club_settings')
      .select('latitude, longitude')
      .limit(1)
      .maybeSingle()

    const lat = Number(settings?.latitude ?? DEFAULT_LAT)
    const lon = Number(settings?.longitude ?? DEFAULT_LON)

    const weatherUrl = new URL('https://api.weatherapi.com/v1/forecast.json')
    weatherUrl.searchParams.set('key', weatherApiKey)
    weatherUrl.searchParams.set('q', `${lat},${lon}`)
    weatherUrl.searchParams.set('days', '1')
    weatherUrl.searchParams.set('aqi', 'no')
    weatherUrl.searchParams.set('alerts', 'no')

    const response = await fetch(weatherUrl.toString())
    const data = (await response.json()) as WeatherApiForecastResponse

    if (data.error) {
      console.error('[fetch-weather] WeatherAPI error:', data.error)
      return new Response(
        JSON.stringify({
          error: data.error.message,
          code: data.error.code,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!response.ok) {
      console.error('[fetch-weather] WeatherAPI HTTP error:', response.status, data)
      return new Response(
        JSON.stringify({
          error: `WeatherAPI HTTP ${response.status}`,
          details: data,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const current = data.current
    const forecastDay = data.forecast?.forecastday?.[0]
    if (!current || !forecastDay) {
      throw new Error('WeatherAPI response missing current or forecast data')
    }

    const wmoCode = mapWeatherApiConditionCode(current.condition.code)
    const mapping = wmoMapping(wmoCode)
    const referenceEpochSec =
      current.last_updated_epoch ?? Math.floor(Date.now() / 1000)
    const hourlyForecast = buildHourlyForecast(forecastDay.hour ?? [], referenceEpochSec)

    await supabase.from('weather_cache').delete().neq('id', 0)

    const { error } = await supabase.from('weather_cache').insert({
      temperature_f: current.temp_f,
      feels_like_f: current.feelslike_f,
      humidity: current.humidity,
      wind_speed_mph: current.wind_mph,
      wind_direction: current.wind_degree,
      weather_code: wmoCode,
      condition_text: current.condition.text,
      icon: mapping.icon,
      cloud_cover: current.cloud,
      uv_index: current.uv,
      precip_probability: forecastDay.day.daily_chance_of_rain,
      is_day: current.is_day,
      hourly_forecast: JSON.stringify(hourlyForecast),
      sunrise_at: astroToTimestamptz(forecastDay.date, forecastDay.astro.sunrise),
      sunset_at: astroToTimestamptz(forecastDay.date, forecastDay.astro.sunset),
      fetched_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error(`Supabase insert error: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        temperature: current.temp_f,
        feels_like: current.feelslike_f,
        humidity: current.humidity,
        wind_speed: current.wind_mph,
        wind_direction: current.wind_degree,
        condition: current.condition.text,
        cloud_cover: current.cloud,
        uv_index: current.uv,
        precip_probability: forecastDay.day.daily_chance_of_rain,
        is_day: current.is_day,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[fetch-weather] Unhandled error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
