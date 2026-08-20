// Helper functions
import { toast } from "./toast";

export function Validate<T extends object>(data: T): boolean {
    for(const [key, value] of Object.entries(data)) {
      if (!value) {
        // Handle empty fields
        toast.warning(`Please fill in the ${key} field.`);
        return false;
      }
    }
    return true;
}