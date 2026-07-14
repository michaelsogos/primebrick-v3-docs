import { useLocation, useNavigate } from "zudoku/router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "zudoku/ui/Select.js";
import { generatedApis } from "../generated-apis";

/**
 * Dropdown that appears at the top of the sidebar on API explorer pages
 * (paths starting with /catalog/). Lets users switch between APIs without
 * going back to the catalog overview.
 */
export default function ApiSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();

  // Only render on API catalog pages
  if (!location.pathname.startsWith("/catalog/")) return null;

  // Find the current API from the path
  const currentApi = generatedApis.find(
    (api) =>
      location.pathname === api.path ||
      location.pathname.startsWith(api.path + "/"),
  );

  // Don't render if we're on the catalog overview itself (no specific API)
  if (!currentApi) return null;

  const handleChange = (value: string) => {
    navigate(value);
  };

  return (
    <div className="px-2 pb-3 pt-2">
      <Select value={currentApi.path} onValueChange={handleChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder="Select API..." />
        </SelectTrigger>
        <SelectContent>
          {generatedApis.map((api) => (
            <SelectItem key={api.path} value={api.path}>
              {api.label ?? api.path}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
