import { X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';

interface FilterSidebarProps {
  selectedTypes: string[];
  onTypeChange: (type: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function FilterSidebar({ selectedTypes, onTypeChange, onClose, isMobile = false }: FilterSidebarProps) {
  const employmentTypes = ['Full-time', 'Part-time', 'Remote', 'Contract'];

  return (
    <div className={`${isMobile ? 'bg-white' : ''}`}>
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className={`${isMobile ? 'p-4' : 'space-y-6'}`}>
        {/* Employment Type Filter */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Employment Type</h3>
          <div className="space-y-3">
            {employmentTypes.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={() => onTypeChange(type)}
                />
                <Label
                  htmlFor={`type-${type}`}
                  className="text-sm font-normal text-gray-700 cursor-pointer"
                >
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Filters */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Job Status</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox id="recent" />
              <Label htmlFor="recent" className="text-sm font-normal text-gray-700 cursor-pointer">
                Recently Posted
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="featured" />
              <Label htmlFor="featured" className="text-sm font-normal text-gray-700 cursor-pointer">
                Featured Jobs
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="urgent" />
              <Label htmlFor="urgent" className="text-sm font-normal text-gray-700 cursor-pointer">
                Urgent Hiring
              </Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
