/**
 * Parses AI response wrapped inside <jsonResponse> tags into a JSON object.
 */
export const parseXmlToJson = (xmlString: string) => {
  const match = xmlString.match(/<jsonResponse>([\s\S]*?)<\/jsonResponse>/);
  if (!match || !match[1]) {
    throw new Error('Invalid XML: No <jsonResponse> element found');
  }

  const jsonText = match[1].trim();

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      'Invalid JSON: Failed to parse content inside <jsonResponse>' + error
    );
  }
};
