import { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react'
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    eachDayOfInterval,
    parse,
    startOfYear,
    endOfYear,
    eachMonthOfInterval,
    isSameYear,
    setMonth,
    setYear,
    getYear,
    getMonth,
    setHours,
    setMinutes,
    getHours,
    getMinutes,
    isBefore,
    startOfDay
} from 'date-fns'
import { useTheme } from '../ThemeContext'

const CustomDateTimePicker = ({
    value,
    onChange,
    label,
    error,
    disabled = false,
    placeholder = 'Select date & time...',
    className = '',
    style = {},
    align = 'left',
    minDate = null
}) => {
    const { effectiveTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)
    const [openUp, setOpenUp] = useState(false)

    // Parse the value or use now
    const initialDate = value ? new Date(value) : new Date()
    const [viewDate, setViewDate] = useState(initialDate)
    const [tempDate, setTempDate] = useState(initialDate)

    const dropdownRef = useRef(null)

    // Sync tempDate with value when it changes externally
    useEffect(() => {
        if (value) {
            const newDate = new Date(value)
            if (!isNaN(newDate)) {
                setTempDate(newDate)
                setViewDate(newDate)
            }
        }
    }, [value])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleDropdown = () => {
        if (disabled) return
        if (!isOpen) {
            setTimeout(() => {
                if (dropdownRef.current) {
                    const rect = dropdownRef.current.getBoundingClientRect()
                    const spaceBelow = window.innerHeight - rect.bottom
                    setOpenUp(spaceBelow < 420)
                }
            }, 0)
        }
        setIsOpen(!isOpen)
    }

    const handleDateSelect = (date) => {
        const currentHours = getHours(tempDate)
        const currentMinutes = getMinutes(tempDate)
        const newDate = setHours(setMinutes(date, currentMinutes), currentHours)
        setTempDate(newDate)
    }

    const handleTimeChange = (type, val) => {
        let newDate = new Date(tempDate)
        const currentHours = getHours(newDate)
        const intVal = parseInt(val)

        if (type === 'hour') {
            if (isNaN(intVal)) return // Allow empty for typing
            // Clamp and convert to 24h
            let h = Math.min(Math.max(intVal, 1), 12)
            const isPM = currentHours >= 12

            if (h === 12) h = 0
            if (isPM && h !== 0) h += 12 // if PM and not 12 (AM midnight equivalent), add 12. 
            // Wait: 12 PM is 12. 1 PM is 13. 
            // Logic: 
            // If AM: 12->0, 1->1, ... 11->11
            // If PM: 12->12, 1->13, ... 11->23

            if (isPM) {
                if (h === 0) h = 12 // 12 PM
                else h += 12
            }

            // Re-eval logic:
            // Input 1-12.
            // If current is PM (>=12):
            //   Input 12 -> 12 (No change needed from 12)
            //   Input 1  -> 13 (+12)
            //   Input 11 -> 23 (+12)
            // If current is AM (<12):
            //   Input 12 -> 0 (-12 or set 0)
            //   Input 1  -> 1
            //   Input 11 -> 11

            let finalH = intVal
            if (isNaN(finalH)) finalH = 12 // Default fallback

            // Allow user to type, but on blur we might want to clamp. For now just handle valid inputs
            if (finalH >= 1 && finalH <= 12) {
                if (isPM) {
                    if (finalH === 12) newDate = setHours(newDate, 12)
                    else newDate = setHours(newDate, finalH + 12)
                } else {
                    if (finalH === 12) newDate = setHours(newDate, 0)
                    else newDate = setHours(newDate, finalH)
                }
            }

        } else if (type === 'minute') {
            if (isNaN(intVal)) return
            let m = Math.min(Math.max(intVal, 0), 59)
            newDate = setMinutes(newDate, m)
        } else if (type === 'period') {
            let h = currentHours % 12
            if (h === 0) h = 12 // 0 is 12 AM

            if (val === 'PM') {
                if (h !== 12) h += 12
                else h = 12 // 12 PM
            } else { // AM
                if (h === 12) h = 0
                // else h is already AM
            }
            newDate = setHours(newDate, h)
        }
        setTempDate(newDate)
    }

    const handleApply = () => {
        if (minDate && isBefore(tempDate, minDate)) {
            // If the selected time is before minDate (e.g. earlier today), sync to minDate
            onChange(minDate.toISOString())
        } else {
            onChange(tempDate.toISOString())
        }
        setIsOpen(false)
    }

    const changeMonth = (amount) => {
        setViewDate(addMonths(viewDate, amount))
    }

    // Calendar Generation
    const renderCalendar = () => {
        const monthStart = startOfMonth(viewDate)
        const monthEnd = endOfMonth(monthStart)
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
        const dateFormat = "d"
        const rows = []
        const days = eachDayOfInterval({ start: startDate, end: endDate })

        const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

        rows.push(
            <div key="week-header" className="calendar-week-header">
                {weekDays.map(day => <div key={day} className="calendar-week-day">{day}</div>)}
            </div>
        )

        let week = []
        days.forEach((day, i) => {
            const isSelected = isSameDay(day, tempDate)
            const isCurrentMonth = isSameMonth(day, monthStart)
            const isToday = isSameDay(day, new Date())
            const isDisabled = minDate && isBefore(startOfDay(day), startOfDay(minDate))

            week.push(
                <div
                    key={day.toString()}
                    className={`calendar-day ${!isCurrentMonth ? 'outside' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && handleDateSelect(day)}
                >
                    {format(day, dateFormat)}
                </div>
            )

            if ((i + 1) % 7 === 0) {
                rows.push(<div key={day.toString() + 'week'} className="calendar-week-row">{week}</div>)
                week = []
            }
        })

        return <div className="calendar-grid">{rows}</div>
    }

    const currentHours24 = getHours(tempDate)
    const displayHour = currentHours24 % 12 || 12
    const period = currentHours24 >= 12 ? 'PM' : 'AM'

    const hours12 = Array.from({ length: 12 }, (_, i) => i + 1)
    const minutes = Array.from({ length: 60 }, (_, i) => i)

    return (
        <div className={`custom-datepicker-container ${className}`} style={{ ...style, zIndex: isOpen ? '10002' : '1', position: 'relative' }} ref={dropdownRef}>
            {label && <label className="form-label">{label}</label>}

            <div
                className={`custom-datepicker-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={toggleDropdown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    minHeight: '42px',
                    transition: 'all 0.2s ease'
                }}
            >
                <div className="trigger-content" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span className={`selected-value ${!value ? 'placeholder' : ''}`} style={{
                        fontSize: '0.9rem',
                        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: value ? 500 : 400
                    }}>
                        {value ? format(new Date(value), 'MMM d, yyyy - hh:mm a') : placeholder}
                    </span>
                </div>
                <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </div>

            {isOpen && (
                <div className={`datepicker-dropdown align-${align} ${openUp ? 'open-up' : ''}`} style={{
                    position: 'absolute',
                    top: openUp ? 'auto' : 'calc(100% + 8px)',
                    bottom: openUp ? 'calc(100% + 8px)' : 'auto',
                    width: '320px',
                    backgroundColor: effectiveTheme === 'dark' ? 'rgba(30, 30, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
                    padding: '1.25rem',
                    zIndex: 10003,
                    animation: openUp ? 'premiumFadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'premiumFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div className="datepicker-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <button type="button" className="nav-btn" onClick={() => changeMonth(-1)} style={navBtnStyle}>
                            <ChevronLeft size={18} />
                        </button>
                        <div className="current-view" style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>
                            {format(viewDate, 'MMMM yyyy')}
                        </div>
                        <button type="button" className="nav-btn" onClick={() => changeMonth(1)} style={navBtnStyle}>
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="datepicker-body">
                        {renderCalendar()}
                    </div>

                    <div className="time-picker-section" style={{
                        marginTop: '1.25rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            <Clock size={14} /> <span>SELECT TIME</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                value={displayHour}
                                onChange={(e) => handleTimeChange('hour', e.target.value)}
                                style={timeSelectStyle}
                            />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>:</span>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={getMinutes(tempDate).toString().padStart(2, '0')}
                                onChange={(e) => handleTimeChange('minute', e.target.value)}
                                style={timeSelectStyle}
                            />
                            <select
                                value={period}
                                onChange={(e) => handleTimeChange('period', e.target.value)}
                                style={{ ...timeSelectStyle, minWidth: '70px', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent-primary)', fontWeight: 700 }}
                            >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                    </div>

                    <div className="datepicker-footer" style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '1.25rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)'
                    }}>
                        <button type="button" className="footer-btn action" onClick={() => {
                            const now = new Date()
                            const dateToSet = minDate && isBefore(now, minDate) ? minDate : now
                            setTempDate(dateToSet)
                            setViewDate(dateToSet)
                        }} style={footerBtnActionStyle}>
                            Today
                        </button>
                        <button type="button" className="footer-btn clear" onClick={() => {
                            onChange('')
                            setIsOpen(false)
                        }} style={footerBtnClearStyle}>
                            Clear
                        </button>
                        <button type="button" className="footer-btn primary" onClick={handleApply} style={footerBtnPrimaryStyle}>
                            Apply
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes premiumFadeIn {
                    from { opacity: 0; transform: translateY(-12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes premiumFadeInUp {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .calendar-grid { display: flex; flex-direction: column; gap: 4px; }
                .calendar-week-header { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 8px; }
                .calendar-week-day { text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
                .calendar-week-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
                .calendar-day { 
                    aspect-ratio: 1; display: flex; align-items: center; justify-content: center; 
                    cursor: pointer; border-radius: 8px; font-size: 0.85rem; transition: all 0.2s ease;
                    color: var(--text-primary);
                }
                .calendar-day:hover:not(.selected) { background-color: var(--bg-secondary); color: var(--accent-primary); }
                .calendar-day.outside { color: var(--text-muted); opacity: 0.3; }
                .calendar-day.selected { background: var(--accent-primary); color: white; font-weight: 700; }
                .calendar-day.today:not(.selected) { color: var(--accent-primary); font-weight: 700; border: 1px solid var(--accent-primary); }
                .calendar-day.disabled { cursor: not-allowed; opacity: 0.2; color: var(--text-muted); }
                .calendar-day.disabled:hover { background: transparent; }
                
                select {
                  appearance: none;
                  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                  background-repeat: no-repeat;
                  background-position: right 0.5rem center;
                  padding-right: 2rem !important;
                }
            `}</style>
        </div>
    )
}

const navBtnStyle = {
    background: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    padding: '6px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
}

const timeSelectStyle = {
    flex: 1,
    padding: '0.6rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer'
}

const footerBtnActionStyle = {
    flex: 1,
    padding: '0.6rem',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--accent-primary)',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer'
}

const footerBtnClearStyle = {
    flex: 1,
    padding: '0.6rem',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer'
}

const footerBtnPrimaryStyle = {
    flex: 1.5,
    padding: '0.6rem',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.2)'
}

export default CustomDateTimePicker
