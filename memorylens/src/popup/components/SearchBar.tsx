import { forwardRef, useState, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

interface Props {
  onSearch: (q: string) => void
  onClear: () => void
  loading: boolean
  hasQuery: boolean
}

const SearchBar = forwardRef<HTMLInputElement, Props>(
  ({ onSearch, onClear, loading, hasQuery }, ref) => {
    const [value, setValue] = useState('')

    useEffect(() => {
      if (!hasQuery && value !== '') setValue('')
    }, [hasQuery, value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      setValue(q)
      onSearch(q) // le debounce est géré dans useSearch
    }

    const handleClear = () => {
      setValue('')
      onClear()
    }

    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            : <Search className="w-4 h-4" />
          }
        </div>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder='ex: "article sur le machine learning"'
          className="input pl-9 pr-9"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }
)
SearchBar.displayName = 'SearchBar'
export default SearchBar
