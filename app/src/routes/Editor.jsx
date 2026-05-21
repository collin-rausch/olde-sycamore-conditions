import React, { useEffect, useRef, useState } from 'react'
import { connectScreenCloud, getScreenCloud } from '@screencloud/apps-editor-sdk'

const MAX_MESSAGE_LENGTH = 160

const defaultConfig = { units: 'fahrenheit', message: '' }

export default function Editor() {
  const [config, setConfig] = useState(defaultConfig)
  const configRef = useRef(config)
  const [, setContext] = useState(null)
  const [initialized, setInitialized] = useState(false)

  configRef.current = config

  const messageLength = (config.message || '').length

  useEffect(() => {
    let subscribed = true

    async function init() {
      try {
        await connectScreenCloud()
        const sc = getScreenCloud()
        const currentConfig = sc.getConfig()
        const currentContext = sc.getContext()

        if (subscribed) {
          setConfig({
            units: currentConfig?.units ?? 'fahrenheit',
            message: currentConfig?.message ?? '',
          })
          setContext(currentContext)
          setInitialized(true)




          // Register callback so ScreenCloud can ask for the latest config on save
          sc.onRequestConfigUpdate(() => {
            const latest = configRef.current
            return { units: latest.units, message: latest.message ?? '' }
          })
        }
      } catch (e) {
        console.log('Not running inside ScreenCloud editor (or dev mode)', e)
        if (subscribed) setInitialized(true)
      }
    }

    init()
    return () => { subscribed = false }
  }, [])

  // When config changes, notify ScreenCloud that an update is available
  useEffect(() => {
    if (!initialized) return
    try {
      const sc = getScreenCloud()
      sc.emitConfigUpdateAvailable({
        units: config.units,
        message: config.message ?? '',
      })
    } catch {
      // Dev mode: no ScreenCloud instance
    }
  }, [config.units, config.message, initialized])

  return (
    <div style={styles.page}>
      <style>{`
        .editor-panel * {
          box-sizing: border-box;
        }
        .editor-panel textarea:focus,
        .editor-panel select:focus {
          outline: none;
          border-color: #2d6a4f;
          box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.15);
        }
      `}</style>

      <div className="editor-panel" style={styles.panel}>
        <header style={styles.header}>
          <h2 style={styles.title}>App Settings</h2>
          <p style={styles.subtitle}>
            Configure how weather and course messaging appear on your screens.
          </p>
        </header>

        <div style={styles.field}>
          <label htmlFor="units" style={styles.label}>
            Temperature Units
          </label>
          <select
            id="units"
            value={config.units}
            onChange={(e) => setConfig((prev) => ({ ...prev, units: e.target.value }))}
            style={styles.select}
          >
            <option value="fahrenheit">Fahrenheit (°F)</option>
            <option value="celsius">Celsius (°C)</option>
          </select>
        </div>

        <div style={styles.field}>
          <label htmlFor="course-message" style={styles.label}>
            Course message
          </label>
          <p style={styles.hint}>
            Shown in the scrolling bar at the bottom of the player display.
          </p>
          <textarea
            id="course-message"
            value={config.message ?? ''}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={4}
            placeholder="Happy hour 4–7 PM · Twilight rates from $45"
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, message: e.target.value }))
            }
            style={styles.textarea}
          />
          <p
            style={{
              ...styles.counter,
              color: messageLength >= MAX_MESSAGE_LENGTH ? '#c41e3a' : '#6b7280',
            }}
          >
            {messageLength} / {MAX_MESSAGE_LENGTH} characters
          </p>
        </div>

        <div style={styles.preview}>
          <h3 style={styles.previewTitle}>Preview</h3>
          <p style={styles.previewText}>
            Temperature will display in{' '}
            <strong>{config.units === 'fahrenheit' ? '°F' : '°C'}</strong>.
          </p>
          {config.message ? (
            <p style={styles.previewText}>
              Scrolling message: <em>{config.message}</em>
            </p>
          ) : (
            <p style={styles.previewMuted}>
              No course message set — the player will use its default message.
            </p>
          )}
          <p style={styles.previewNote}>
            Weather data updates automatically every ~15 minutes via Open-Meteo.
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '2rem 1.25rem',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  panel: {
    maxWidth: '520px',
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    padding: '2rem 2.25rem',
    color: '#1a1a1a',
  },
  header: {
    marginBottom: '1.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#111827',
  },
  subtitle: {
    margin: '0.5rem 0 0',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: '#6b7280',
    fontWeight: 400,
  },
  field: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.5rem',
  },
  hint: {
    margin: '0 0 0.5rem',
    fontSize: '0.8rem',
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  select: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#111827',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    resize: 'vertical',
    minHeight: '96px',
    fontFamily: 'inherit',
    color: '#111827',
  },
  counter: {
    margin: '0.4rem 0 0',
    fontSize: '0.8rem',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  preview: {
    marginTop: '0.5rem',
    padding: '1.25rem',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  previewTitle: {
    margin: '0 0 0.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#374151',
  },
  previewText: {
    margin: '0 0 0.5rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: '#4b5563',
  },
  previewMuted: {
    margin: '0 0 0.5rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  previewNote: {
    margin: '0.75rem 0 0',
    fontSize: '0.8rem',
    color: '#9ca3af',
    lineHeight: 1.4,
  },
}
