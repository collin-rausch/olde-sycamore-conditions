import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const LOGO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png'

const STATUS_OPTIONS = ['Open', 'Frost Delay', 'Closed']
const CART_OPTIONS = ['Fairways Open', '90° Rule', 'Cart Paths Only']
const FAIRWAY_OPTIONS = ['Firm', 'Normal', 'Soft', 'Wet']
const BUNKER_OPTIONS = ['Groomed', 'Normal', 'Wet', 'Under Maintenance']

const DEFAULT_FORM = {
  course_status: 'Open',
  cart_rule: '90° Rule',
  greens_speed: 11.2,
  fairway_condition: 'Firm',
  bunker_condition: 'Groomed',
  daily_note: '',
}

function formatTodayDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function formatLastUpdated(iso) {
  if (!iso) return 'Last updated: —'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'Last updated: —'

  const now = new Date()
  const mins = Math.floor((now - then) / 60000)
  const isToday = then.toDateString() === now.toDateString()

  if (mins < 1) return 'Last updated: just now'
  if (mins < 60) return `Last updated: ${mins} minute${mins === 1 ? '' : 's'} ago`
  if (isToday) {
    return `Last updated: ${then.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    })}`
  }
  return `Last updated: ${then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })}`
}

function rowToForm(row) {
  if (!row) return { ...DEFAULT_FORM }
  return {
    course_status: row.course_status ?? DEFAULT_FORM.course_status,
    cart_rule: row.cart_rule ?? DEFAULT_FORM.cart_rule,
    greens_speed: Number(row.greens_speed) || DEFAULT_FORM.greens_speed,
    fairway_condition: row.fairway_condition ?? DEFAULT_FORM.fairway_condition,
    bunker_condition: row.bunker_condition ?? DEFAULT_FORM.bunker_condition,
    daily_note: row.daily_note ?? '',
  }
}

function getStatusButtonStyle(value, active) {
  if (!active) {
    return {
      background: 'rgba(255,255,255,0.04)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.35)',
    }
  }
  if (value === 'Open') {
    return {
      background: '#166534',
      border: '0.5px solid rgba(74,222,128,0.4)',
      color: '#4ade80',
    }
  }
  if (value === 'Frost Delay') {
    return {
      background: 'rgba(59,130,246,0.25)',
      border: '0.5px solid rgba(96,165,250,0.4)',
      color: '#93c5fd',
    }
  }
  return {
    background: 'rgba(127,29,29,0.60)',
    border: '0.5px solid rgba(248,113,113,0.4)',
    color: '#f87171',
  }
}

function getCartButtonStyle(active) {
  if (!active) {
    return {
      background: 'rgba(255,255,255,0.04)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.35)',
    }
  }
  return {
    background: '#166534',
    border: '0.5px solid rgba(74,222,128,0.4)',
    color: '#4ade80',
  }
}

function OptionButtons({ options, value, onChange, getStyle }) {
  return (
    <div style={styles.btnRow}>
      {options.map((opt) => {
        const active = value === opt
        const btnStyle = getStyle(opt, active)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{ ...styles.optionBtn, ...btnStyle }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function Admin() {
  const [rowId, setRowId] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const loadCourseStatus = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('course_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      setLoadError(fetchError.message)
      setLoading(false)
      return
    }

    if (data) {
      setRowId(data.id)
      setForm(rowToForm(data))
      setLastUpdated(data.updated_at)
    }
    setLoadError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCourseStatus()
  }, [loadCourseStatus])

  useEffect(() => {
    const channel = supabase
      .channel('admin-course-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'course_status' },
        (payload) => {
          if (payload.new) {
            setRowId(payload.new.id)
            setForm(rowToForm(payload.new))
            setLastUpdated(payload.new.updated_at)
          }
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const handleSave = async () => {
    if (!rowId || saving) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    const updatedAt = new Date().toISOString()
    const { error: saveError } = await supabase
      .from('course_status')
      .update({
        course_status: form.course_status,
        cart_rule: form.cart_rule,
        greens_speed: form.greens_speed,
        fairway_condition: form.fairway_condition,
        bunker_condition: form.bunker_condition,
        daily_note: form.daily_note.trim(),
        updated_at: updatedAt,
      })
      .eq('id', rowId)

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setLastUpdated(updatedAt)
    setSuccess(true)
  }

  useEffect(() => {
    if (!success) return undefined
    const timer = setTimeout(() => setSuccess(false), 3000)
    return () => clearTimeout(timer)
  }, [success])

  const adjustGreens = (delta) => {
    setForm((f) => ({
      ...f,
      greens_speed: Math.round((f.greens_speed + delta) * 10) / 10,
    }))
  }

  const noteLen = form.daily_note.length
  const saveLabel = saving ? 'Saving...' : success ? 'Saved ✓' : 'Save Morning Setup'

  return (
    <div className="admin-page">
      <style>{`
        .admin-page {
          min-height: 100vh;
          background: #0a0f0b;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .admin-page * {
          box-sizing: border-box;
        }

        .admin-inner {
          max-width: 480px;
          margin: 0 auto;
          padding: clamp(20px, 4vw, 28px) clamp(16px, 4vw, 20px) 0;
        }

        .admin-select {
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='rgba(255,255,255,0.45)' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }

        .admin-greens-input::-webkit-outer-spin-button,
        .admin-greens-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .admin-greens-input {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="admin-inner">
        <header style={styles.header}>
          <img src={LOGO_URL} alt="Olde Sycamore Golf Club" style={styles.logo} />
          <p style={styles.headerEyebrow}>Morning Setup</p>
          <p style={styles.headerDate}>{formatTodayDate()}</p>
        </header>

        {loading && (
          <p style={styles.loadingText}>Loading course setup…</p>
        )}

        {loadError && (
          <p style={styles.errorText}>{loadError}</p>
        )}

        {!loading && (
          <>
            <section style={styles.card}>
              <p style={styles.sectionLabel}>Course Status</p>
              <OptionButtons
                options={STATUS_OPTIONS}
                value={form.course_status}
                onChange={(v) => setForm((f) => ({ ...f, course_status: v }))}
                getStyle={getStatusButtonStyle}
              />
            </section>

            <section style={styles.card}>
              <p style={styles.sectionLabel}>Cart Rule</p>
              <OptionButtons
                options={CART_OPTIONS}
                value={form.cart_rule}
                onChange={(v) => setForm((f) => ({ ...f, cart_rule: v }))}
                getStyle={getCartButtonStyle}
              />
            </section>

            <section style={styles.card}>
              <p style={styles.sectionLabel}>Greens Speed</p>
              <input
                className="admin-greens-input"
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={form.greens_speed}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  setForm((f) => ({
                    ...f,
                    greens_speed: Number.isFinite(n) ? n : f.greens_speed,
                  }))
                }}
                style={styles.greensInput}
                aria-label="Greens speed"
              />
              <p style={styles.greensUnit}>ft (Stimpmeter)</p>
              <div style={styles.stepperRow}>
                <button
                  type="button"
                  style={styles.stepperBtn}
                  onClick={() => adjustGreens(-0.1)}
                  aria-label="Decrease greens speed"
                >
                  −
                </button>
                <button
                  type="button"
                  style={styles.stepperBtn}
                  onClick={() => adjustGreens(0.1)}
                  aria-label="Increase greens speed"
                >
                  +
                </button>
              </div>
            </section>

            <section style={styles.card}>
              <p style={styles.sectionLabel}>Conditions</p>
              <div style={styles.dropdownRow}>
                <div style={styles.dropdownCol}>
                  <p style={styles.dropdownSub}>Fairways</p>
                  <select
                    className="admin-select"
                    style={styles.select}
                    value={form.fairway_condition}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fairway_condition: e.target.value }))
                    }
                  >
                    {FAIRWAY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.dropdownCol}>
                  <p style={styles.dropdownSub}>Bunkers</p>
                  <select
                    className="admin-select"
                    style={styles.select}
                    value={form.bunker_condition}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, bunker_condition: e.target.value }))
                    }
                  >
                    {BUNKER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <p style={styles.sectionLabel}>Today&apos;s Note</p>
              <textarea
                style={styles.textarea}
                rows={3}
                maxLength={120}
                placeholder="e.g. Cart paths only until 10 AM after overnight moisture."
                value={form.daily_note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, daily_note: e.target.value }))
                }
              />
              <p
                style={{
                  ...styles.charCount,
                  color: noteLen > 100 ? '#f87171' : 'rgba(255,255,255,0.35)',
                }}
              >
                {noteLen} / 120
              </p>
            </section>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !rowId}
              style={{
                ...styles.saveBtn,
                opacity: saving ? 0.7 : 1,
                background: success ? '#14532d' : '#166534',
              }}
            >
              {saveLabel}
            </button>

            {error && <p style={styles.errorText}>{error}</p>}

            <p style={styles.lastUpdated}>{formatLastUpdated(lastUpdated)}</p>

            <p style={styles.footer}>Olde Sycamore Golf Club</p>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  header: {
    textAlign: 'center',
    marginBottom: 'clamp(20px, 4vh, 28px)',
  },
  logo: {
    display: 'block',
    margin: '0 auto',
    height: '40px',
    width: 'auto',
    objectFit: 'contain',
    filter: 'brightness(10)',
    opacity: 0.9,
  },
  headerEyebrow: {
    margin: '12px 0 0',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  headerDate: {
    margin: '6px 0 0',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.30)',
  },
  card: {
    background: '#111814',
    border: '0.5px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '12px',
  },
  sectionLabel: {
    margin: '0 0 12px',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.38)',
  },
  btnRow: {
    display: 'flex',
    gap: '8px',
    width: '100%',
  },
  optionBtn: {
    flex: 1,
    minHeight: '48px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '0 6px',
    lineHeight: 1.2,
  },
  greensInput: {
    display: 'block',
    width: '100%',
    fontSize: '48px',
    fontWeight: 200,
    color: '#ffffff',
    textAlign: 'center',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    margin: '0',
    padding: '0',
  },
  greensUnit: {
    margin: '4px 0 16px',
    textAlign: 'center',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
  },
  stepperRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
  },
  stepperBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    color: '#ffffff',
    fontSize: '20px',
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownRow: {
    display: 'flex',
    gap: '12px',
  },
  dropdownCol: {
    flex: 1,
    minWidth: 0,
  },
  dropdownSub: {
    margin: '0 0 6px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.40)',
  },
  select: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    padding: '12px',
    minHeight: '48px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    padding: '12px',
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.45,
    outline: 'none',
  },
  charCount: {
    margin: '8px 0 0',
    textAlign: 'right',
    fontSize: '11px',
  },
  saveBtn: {
    width: '100%',
    minHeight: '56px',
    borderRadius: '14px',
    border: '0.5px solid rgba(74,222,128,0.35)',
    color: '#4ade80',
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px',
  },
  lastUpdated: {
    margin: '8px 0 0',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    textAlign: 'center',
  },
  footer: {
    margin: '24px 0 0',
    paddingBottom: '32px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.20)',
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '14px',
    marginTop: '24px',
  },
  errorText: {
    margin: '8px 0 0',
    textAlign: 'center',
    color: '#f87171',
    fontSize: '13px',
  },
}
