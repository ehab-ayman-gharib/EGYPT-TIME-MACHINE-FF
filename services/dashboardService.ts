/**
 * DASHBOARD ANALYTICS SERVICE
 * ---------------------------
 * Handles tracking and reporting generation metrics to the central photobooth dashboard.
 */

const DASHBOARD_API_URL = "https://cairo-airport-photobooth-dashboard.vercel.app/api/projects/0397f1e6-32f8-4330-9156-ec541fadcda6/generate";

/**
 * Increments the generated images count on the dashboard API.
 * Triggered on every successful photo generation across all modes (Gemini, FaceFusion, Snap a Memory).
 */
export const incrementGeneratedCount = async (): Promise<void> => {
  try {
    const response = await fetch(DASHBOARD_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.warn(`[Dashboard] Failed to increment count: ${response.status} ${response.statusText}`);
    } else {
      console.log('[Dashboard] Successfully incremented generation count');
    }
  } catch (error) {
    console.error('[Dashboard] Error calling increment API:', error);
  }
};
