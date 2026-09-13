/**
 * Saves a file the user is looking at, in a browser.
 *
 * The anchor's own `download` attribute is ignored for a cross-origin file, and
 * the clips live on Supabase rather than here — so what actually makes this save
 * instead of navigate is the `download` parameter already on the signed URL,
 * which makes storage answer with Content-Disposition: attachment.
 */
export async function downloadFile(url: string): Promise<void> {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  // Belt and braces: honoured if the response ever becomes same-origin.
  link.download = '';

  document.body.appendChild(link);
  link.click();
  link.remove();
}
