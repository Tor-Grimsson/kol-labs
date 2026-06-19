import React from 'react'

const ToggleSwitch = ({
  label,
  checked = false,
  onChange,
  onToggle,
  variant = 'default',
  className = '',
  hint,
  labeled = false, // label adopts the DS "labeled" text style (matches a labeled Slider)
  ...props
}) => {
  const handleClick = () => {
    if (onToggle) onToggle(!checked)
    if (onChange) onChange(!checked)
  }

  const variantClass = variant === 'plain' ? 'toggle-switch--plain' : ''

  return (
    <button
      type="button"
      className={`toggle-switch ${variantClass} ${className}`.trim()}
      data-state={checked ? 'on' : 'off'}
      onClick={handleClick}
      aria-pressed={checked}
      {...props}
    >
      <span
        className={labeled ? 'kol-helper-10 uppercase tracking-widest' : 'toggle-switch-label'}
        style={labeled ? { color: 'var(--kol-fg-meta)' } : undefined}
      >
        {label}
        {hint ? (
          <span className="ml-2 opacity-60 normal-case tracking-normal text-[10px]">
            {hint}
          </span>
        ) : null}
      </span>
      <span className="toggle-switch-indicator" aria-hidden="true" />
    </button>
  )
}

export default ToggleSwitch
