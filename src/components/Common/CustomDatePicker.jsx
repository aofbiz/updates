import { useState, useRef, useEffect } from 'react'
import { Calendar, Crown, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react'
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
    isBefore,
    isAfter,
    startOfDay
} from 'date-fns'
import { useTheme } from '../ThemeContext'

const CustomDatePicker = ({
    value,
    onChange,
    label,
    error,
    disabled = false,
    isLocked = false,
    lockIcon: LockIcon = Crown,
    type = 'date', // 'date' or 'month'
    min,
    max,
    placeholder,
    className = '',
    style = {},
    align = 'left' // 'left' or 'right'
}) => {
    const { effectiveTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)
    const [viewDate, setViewDate] = useState(value ? (type === 'month' ? parse(value, 'yyyy-MM', new Date()) : parse(value, 'yyyy-MM-dd', new Date())) : new Date())
    const dropdownRef = useRef(null)

    // Sync viewDate with value when it changes externally
    useEffect(() => {
        if (value) {
            const newDate = type === 'month' ? parse(value, 'yyyy-MM', new Date()) : parse(value, 'yyyy-MM-dd', new Date())
            if (!isNaN(newDate)) setViewDate(newDate)
        }
    }, [value, type])

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
        if (disabled || isLocked) return
        setIsOpen(!isOpen)
    }

    const handleDateSelect = (date) => {
        const formattedDate = format(date, 'yyyy-MM-dd')
        onChange(formattedDate)
        setIsOpen(false)
    }

    const handleMonthSelect = (date) => {
        const formattedDate = format(date, 'yyyy-MM')
        onChange(formattedDate)
        setIsOpen(false)
    }

    const changeMonth = (amount) => {
        setViewDate(addMonths(viewDate, amount))
    }

    const changeYear = (amount) => {
        setViewDate(setYear(viewDate, getYear(viewDate) + amount))
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
            const isSelected = value && isSameDay(day, parse(value, 'yyyy-MM-dd', new Date()))
            const isCurrentMonth = isSameMonth(day, monthStart)
            const isToday = isSameDay(day, new Date())

            let isDisabled = false
            if (min) {
                const minD = typeof min === 'string' ? parse(min, 'yyyy-MM-dd', new Date()) : min
                if (isBefore(startOfDay(day), startOfDay(minD))) isDisabled = true
            }
            if (max) {
                const maxD = typeof max === 'string' ? parse(max, 'yyyy-MM-dd', new Date()) : max
                if (isAfter(startOfDay(day), startOfDay(maxD))) isDisabled = true
            }

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

    // Month Grid Generation
    const renderMonthGrid = () => {
        const yearStart = startOfYear(viewDate)
        const yearEnd = endOfYear(yearStart)
        const months = eachMonthOfInterval({ start: yearStart, end: yearEnd })

        return (
            <div className="month-grid">
                {months.map(m => {
                    const isSelected = value && isSameYear(m, parse(value, 'yyyy-MM', new Date())) && getMonth(m) === getMonth(parse(value, 'yyyy-MM', new Date()))
                    const isCurrentMonth = isSameMonth(m, new Date())

                    return (
                        <div
                            key={m.toString()}
                            className={`month-cell ${isSelected ? 'selected' : ''} ${isCurrentMonth ? 'today' : ''}`}
                            onClick={() => handleMonthSelect(m)}
                        >
                            {format(m, 'MMM')}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className={`custom-datepicker-container ${className}`} style={{ ...style, zIndex: isOpen ? '10002' : '1' }} ref={dropdownRef}>
            {label && <label className="form-label">{label}</label>}

            <div
                className={`custom-datepicker-trigger ${isOpen ? 'open' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''}`}
                onClick={toggleDropdown}
            >
                <div className="trigger-content">
                    {isLocked ? (
                        <LockIcon size={14} className="lock-icon" />
                    ) : (
                        <Calendar size={16} className="calendar-icon" />
                    )}
                    <span className={`selected-value ${!value ? 'placeholder' : ''}`}>
                        {value ? (type === 'month' ? format(parse(value, 'yyyy-MM', new Date()), 'MMMM yyyy') : format(parse(value, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')) : (placeholder || (type === 'month' ? 'Select month' : 'Select date'))}
                    </span>
                </div>
                <ChevronDown size={18} className={`chevron-icon ${isOpen ? 'rotate' : ''}`} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>

            {isOpen && (
                <div className={`datepicker-dropdown align-${align}`}>
                    <div className="datepicker-header">
                        <button type="button" className="nav-btn" onClick={() => type === 'date' ? changeMonth(-1) : changeYear(-1)}>
                            <ChevronLeft size={18} />
                        </button>
                        <div className="current-view">
                            {type === 'date' ? format(viewDate, 'MMMM yyyy') : format(viewDate, 'yyyy')}
                        </div>
                        <button type="button" className="nav-btn" onClick={() => type === 'date' ? changeMonth(1) : changeYear(1)}>
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="datepicker-body">
                        {type === 'date' ? renderCalendar() : renderMonthGrid()}
                    </div>

                    <div className="datepicker-footer">
                        <button type="button" className="footer-btn action" onClick={() => {
                            let now = new Date()
                            if (min) {
                                const minD = typeof min === 'string' ? parse(min, 'yyyy-MM-dd', new Date()) : min
                                if (isBefore(now, minD)) now = minD
                            }
                            if (max) {
                                const maxD = typeof max === 'string' ? parse(max, 'yyyy-MM-dd', new Date()) : max
                                if (isAfter(now, maxD)) now = maxD
                            }
                            if (type === 'date') handleDateSelect(now)
                            else handleMonthSelect(now)
                        }}>
                            {type === 'date' ? 'Today' : 'This Month'}
                        </button>
                        <button type="button" className="footer-btn clear" onClick={() => {
                            onChange('')
                            setIsOpen(false)
                        }}>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .custom-datepicker-container {
                    position: relative;
                    width: 100%;
                }

                .custom-datepicker-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.6rem 0.85rem;
                    background-color: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-height: 42px;
                }

                .custom-datepicker-trigger:hover:not(.disabled):not(.locked) {
                    border-color: var(--accent-primary);
                    background-color: var(--bg-card-hover);
                }

                .custom-datepicker-trigger.open {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 3px rgba(255, 46, 54, 0.1);
                }

                .custom-datepicker-trigger.error {
                    border-color: var(--danger);
                }

                .custom-datepicker-trigger.disabled {
                    cursor: not-allowed;
                    opacity: 0.6;
                    background-color: var(--bg-secondary);
                }

                .custom-datepicker-trigger.locked {
                    cursor: not-allowed;
                    background-color: var(--bg-secondary);
                    opacity: 0.8;
                }

                .trigger-content {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex: 1;
                    overflow: hidden;
                }

                .calendar-icon, .lock-icon {
                    color: var(--accent-primary);
                    flex-shrink: 0;
                }

                .selected-value {
                    font-size: 0.9rem;
                    color: var(--text-primary);
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .selected-value.placeholder {
                    color: var(--text-muted);
                    font-weight: 400;
                }

                .chevron-icon {
                    transition: transform 0.3s ease;
                }

                .chevron-icon.rotate {
                    transform: rotate(180deg);
                }

                /* Dropdown Menu */
                .datepicker-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    width: 290px;
                    background-color: ${effectiveTheme === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                    padding: 1.25rem;
                    z-index: 10001;
                    animation: premiumFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .datepicker-dropdown.align-left {
                    left: 0;
                }

                .datepicker-dropdown.align-right {
                    right: 0;
                }

                @keyframes premiumFadeIn {
                    from { opacity: 0; transform: translateY(-12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .datepicker-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1.25rem;
                }

                .current-view {
                    font-weight: 800;
                    color: var(--text-primary);
                    font-size: 1rem;
                    letter-spacing: -0.01em;
                }

                .nav-btn {
                    background: var(--bg-secondary);
                    color: var(--text-muted);
                    padding: 6px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid transparent;
                }

                .nav-btn:hover {
                    background: var(--accent-primary);
                    color: white;
                    border-color: rgba(255, 255, 255, 0.1);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(255, 46, 54, 0.2);
                }

                .calendar-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .calendar-week-header {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    margin-bottom: 8px;
                }

                .calendar-week-day {
                    text-align: center;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-muted);
                }

                .calendar-week-row {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }

                .calendar-day {
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    transition: all 0.2s ease;
                }

                .calendar-day:hover:not(.selected) {
                    background-color: var(--bg-secondary);
                    color: var(--accent-primary);
                }

                .calendar-day.outside {
                    color: var(--text-muted);
                    opacity: 0.3;
                }

                .calendar-day.selected {
                    background: var(--accent-primary);
                    color: white;
                    font-weight: 700;
                }

                .calendar-day.today:not(.selected) {
                    color: var(--accent-primary);
                    font-weight: 700;
                    border: 1px solid var(--accent-primary);
                }
                
                .calendar-day.disabled {
                    cursor: not-allowed;
                    opacity: 0.2;
                    color: var(--text-muted);
                }
                
                .calendar-day.disabled:hover {
                    background: transparent;
                }

                .month-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                }

                .month-cell {
                    padding: 12px 6px;
                    text-align: center;
                    cursor: pointer;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    transition: all 0.2s ease;
                }

                .month-cell:hover:not(.selected) {
                    background-color: var(--bg-secondary);
                    color: var(--accent-primary);
                }

                .month-cell.selected {
                    background: var(--accent-primary);
                    color: white;
                    font-weight: 700;
                }

                .month-cell.today:not(.selected) {
                    color: var(--accent-primary);
                    font-weight: 700;
                    border: 1px solid var(--accent-primary);
                }

                .datepicker-footer {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                    padding-top: 12px;
                    border-top: 1px solid var(--border-color);
                }

                .footer-btn {
                    flex: 1;
                    padding: 8px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid transparent;
                }

                .footer-btn.action {
                    background-color: var(--bg-secondary);
                    color: var(--accent-primary);
                }

                .footer-btn.clear {
                    background-color: var(--bg-secondary);
                    color: var(--text-muted);
                }

                .footer-btn:hover {
                    opacity: 0.8;
                }
            `}</style>
        </div>
    )
}

export default CustomDatePicker
