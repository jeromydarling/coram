/**
 * Removes meeting boilerplate (Zoom, Teams, Google Meet URLs, dial-in info)
 * from event descriptions. Users access meeting links on their phones anyway.
 */
export function sanitizeEventDescription(description: string): string | null {
  const meetingPatterns = [
    /^.*join.*zoom.*meeting.*$/gim,
    /https?:\/\/[^\s]*zoom\.us[^\s]*/gi,
    /https?:\/\/[^\s]*teams\.microsoft\.com[^\s]*/gi,
    /meeting id:.*$/gim,
    /passcode:.*$/gim,
    /one tap mobile.*$/gim,
    /dial by your location.*$/gim,
    /find your local number.*$/gim,
    /join with google meet.*$/gim,
    /https?:\/\/meet\.google\.com[^\s]*/gi,
    /-{3,}/g, // Horizontal dividers
  ];
  
  let cleaned = description;
  meetingPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Remove excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  // Return null if nothing meaningful remains
  return cleaned.length > 10 ? cleaned : null;
}
