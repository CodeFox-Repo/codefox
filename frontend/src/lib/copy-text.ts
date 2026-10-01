import { toast } from 'sonner';

/** Clipboard access can be unavailable or denied even on a visible button. */
export async function copyText(
  text: string,
  successMessage: string
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error('Could not copy to clipboard. Try again.');
    return false;
  }
}
