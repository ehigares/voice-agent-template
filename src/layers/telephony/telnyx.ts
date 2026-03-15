import Telnyx from 'telnyx';
import { config } from '../../config.js';

const telnyx = new Telnyx({ apiKey: config.TELNYX_API_KEY });

export async function listPhoneNumbers(): Promise<{ phoneNumber: string; id: string }[]> {
  const response = await telnyx.phoneNumbers.list();
  return (response.data ?? []).map((pn) => ({
    phoneNumber: pn.phone_number as string,
    id: pn.id as string,
  }));
}

export async function getPhoneNumber(id: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await telnyx.phoneNumbers.retrieve(id);
    return response.data as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export { telnyx };
