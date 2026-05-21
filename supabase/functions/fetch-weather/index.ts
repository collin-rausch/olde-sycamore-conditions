import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEATHER_CODES: Record<number, { text: string; icon: string }> = {
  0:  { text: 'Clear sky', icon: '☀️' },
  1:  { text: 'Mainly clear', icon: '🌤️' },
  2:  { text: 'Partly cloudy', icon: '⛅' },
  3:  { text: 'Overcast', icon: '☁️' },
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

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const lat = 35.2271
    const lon = -80.8431

    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=America%2FNew_York&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,uv_index,precipitation_probability,is_day&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1`

    const response = await fetch(openMeteoUrl)
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const current = data.current
    const daily = data.daily

    const code = current.weather_code as number
    const mapping = WEATHER_CODES[code] || { text: 'Unknown', icon: '❓' }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })

    await supabase.from('weather_cache').delete().neq('id', 0)

    const { error } = await supabase.from('weather_cache').insert({
      temperature_f: current.temperature_2m as number,
      feels_like_f: current.apparent_temperature as number,
      humidity: current.relative_humidity_2m as number,
      wind_speed_mph: current.wind_speed_10m as number,
      wind_direction: current.wind_direction_10m as number,
      weather_code: code,
      condition_text: mapping.text,
      icon: mapping.icon,
      cloud_cover: current.cloud_cover as number,
      uv_index: current.uv_index as number,
      precip_probability: current.precipitation_probability as number,
      is_day: current.is_day as number,
      hourly_forecast: JSON.stringify({
        time: data.hourly.time,
        temperature: data.hourly.temperature_2m,
        precip_probability: data.hourly.precipitation_probability,
        weather_code: data.hourly.weather_code,
        wind_speed: data.hourly.wind_speed_10m,
      }),
      sunrise_at: daily?.sunrise?.[0] ?? null,
      sunset_at: daily?.sunset?.[0] ?? null,
      fetched_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error(`Supabase insert error: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        temperature: current.temperature_2m,
        feels_like: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        wind_speed: current.wind_speed_10m,
        wind_direction: current.wind_direction_10m,
        condition: mapping.text,
        cloud_cover: current.cloud_cover,
        uv_index: current.uv_index,
        precip_probability: current.precipitation_probability,
        is_day: current.is_day,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})