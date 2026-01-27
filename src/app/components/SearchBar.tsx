import { Search, MapPin, Filter } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterToggle: () => void;
  showMobileFilters: boolean;
}

export function SearchBar({ searchQuery, onSearchChange, onFilterToggle, showMobileFilters }: SearchBarProps) {
  return (
    <div className="bg-white border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-3 items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by job title, location, or skills..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-12 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Mobile Filter Button */}
          <Button
            onClick={onFilterToggle}
            variant="outline"
            className="lg:hidden h-12 w-12 p-0 rounded-xl border-gray-200 shadow-sm"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
