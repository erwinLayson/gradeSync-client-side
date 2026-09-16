// Helper functions
import { toast } from "./toast";

export function Validate<T extends object>(data: T): boolean {
    for(const [key, value] of Object.entries(data)) {
      // Treat null/undefined/empty-or-whitespace strings as missing. Legit
      // falsy values (0, false) are NOT empty.
      if (value === null || value === undefined || String(value).trim() === "") {
        // Handle empty fields
        toast.warning(`Please fill in the ${key} field.`);
        return false;
      }
    }
    return true;
}