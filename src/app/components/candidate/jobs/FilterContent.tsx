import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { Separator } from "@/app/components/ui/separator";

export function FilterContent({
  employmentTypes,
  experienceLevels,
  locations,
  selectedTypes,
  selectedLevels,
  selectedLocations,
  onTypeChange,
  onLevelChange,
  onLocationChange,
  onClearAll,
  activeCount,
}: {
  employmentTypes: string[];
  experienceLevels: string[];
  locations: string[];
  selectedTypes: string[];
  selectedLevels: string[];
  selectedLocations: string[];
  onTypeChange: (type: string) => void;
  onLevelChange: (level: string) => void;
  onLocationChange: (location: string) => void;
  onClearAll: () => void;
  activeCount: number;
}) {
  return (
    <div className="space-y-6 pb-6">
      {activeCount > 0 && (
        <Button variant="outline" onClick={onClearAll} className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-400/20 dark:hover:bg-red-950/30">
          Clear all filters ({activeCount})
        </Button>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Employment Type</h3>
        <div className="space-y-3">
          {employmentTypes.map((type) => (
            <div key={type} className="flex items-center">
              <Checkbox id={`type-${type}`} checked={selectedTypes.includes(type)} onCheckedChange={() => onTypeChange(type)} className="rounded border-gray-300" />
              <Label htmlFor={`type-${type}`} className="ml-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{type}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Experience Level</h3>
        <div className="space-y-3">
          {experienceLevels.map((level) => (
            <div key={level} className="flex items-center">
              <Checkbox id={`level-${level}`} checked={selectedLevels.includes(level)} onCheckedChange={() => onLevelChange(level)} className="rounded border-gray-300" />
              <Label htmlFor={`level-${level}`} className="ml-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{level}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Location</h3>
        <div className="space-y-3">
          {locations.map((location) => (
            <div key={location} className="flex items-center">
              <Checkbox id={`location-${location}`} checked={selectedLocations.includes(location)} onCheckedChange={() => onLocationChange(location)} className="rounded border-gray-300" />
              <Label htmlFor={`location-${location}`} className="ml-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{location}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

