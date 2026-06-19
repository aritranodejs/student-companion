import { HiSearch } from 'react-icons/hi'

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <HiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-10"
      />
    </div>
  )
}
