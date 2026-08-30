import { Linking } from 'react-native';

/**
 * Saves a file the user is looking at.
 *
 * On a phone there is nowhere useful to "download" to, so this hands the URL to
 * the OS, which opens its own save or share sheet. The URL already carries
 * Supabase's `download` parameter, so the response arrives as an attachment
 * rather than something to stream.
 */
export async function downloadFile(url: string): Promise<void> {
  await Linking.openURL(url);
}
