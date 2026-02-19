/**
 * Social Media Posting Module
 * 
 * Handles posting to:
 * - X/Twitter: Direct via API v2 (OAuth 1.0a)
 * - Instagram: Direct via Instagram Graph API (Content Publishing)
 * - TikTok: Not yet supported
 * 
 * Config stored in env vars.
 */

import crypto from 'crypto';

// ─── X/Twitter Direct Posting ───

interface XConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function getXConfig(): XConfig | null {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function generateOAuthHeader(method: string, url: string, config: XConfig): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, config.apiSecret, config.accessTokenSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`);
  return `OAuth ${headerParts.join(', ')}`;
}

export async function postToX(text: string): Promise<{ ok: boolean; tweetId?: string; error?: string }> {
  const config = getXConfig();
  if (!config) return { ok: false, error: 'X API credentials not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.' };

  const url = 'https://api.x.com/2/tweets';
  const authHeader = generateOAuthHeader('POST', url, config);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (res.ok && data.data?.id) {
      return { ok: true, tweetId: data.data.id };
    }
    return { ok: false, error: JSON.stringify(data.errors || data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Instagram Direct Posting (Graph API) ───

interface InstagramConfig {
  accessToken: string;
  userId: string;
}

function getInstagramConfig(): InstagramConfig | null {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!accessToken || !userId) return null;
  return { accessToken, userId };
}

/**
 * Post an image to Instagram.
 * Instagram requires a publicly accessible image URL — text-only posts are not supported.
 * For text-only content, we skip Instagram or use a branded image.
 */
export async function postToInstagram(
  caption: string,
  imageUrl?: string,
): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
  const config = getInstagramConfig();
  if (!config) return { ok: false, error: 'Instagram credentials not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID.' };

  // Instagram requires an image — can't do text-only posts
  if (!imageUrl) {
    return { ok: false, error: 'Instagram requires an image URL. Text-only posts are not supported.' };
  }

  try {
    // Step 1: Create media container
    const createRes = await fetch(`https://graph.instagram.com/v21.0/${config.userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: config.accessToken,
      }),
    });

    const createData = await createRes.json();
    if (!createData.id) {
      return { ok: false, error: JSON.stringify(createData.error || createData) };
    }

    // Step 2: Wait a moment for processing
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Publish the container
    const publishRes = await fetch(`https://graph.instagram.com/v21.0/${config.userId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: createData.id,
        access_token: config.accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (publishData.id) {
      return { ok: true, mediaId: publishData.id };
    }
    return { ok: false, error: JSON.stringify(publishData.error || publishData) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Post a carousel (multiple images) to Instagram.
 */
export async function postCarouselToInstagram(
  caption: string,
  imageUrls: string[],
): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
  const config = getInstagramConfig();
  if (!config) return { ok: false, error: 'Instagram credentials not configured.' };
  if (imageUrls.length < 2) return { ok: false, error: 'Carousel requires at least 2 images.' };

  try {
    // Step 1: Create individual media containers for each image
    const childIds: string[] = [];
    for (const url of imageUrls) {
      const res = await fetch(`https://graph.instagram.com/v21.0/${config.userId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          image_url: url,
          is_carousel_item: 'true',
          access_token: config.accessToken,
        }),
      });
      const data = await res.json();
      if (!data.id) return { ok: false, error: `Failed to create carousel item: ${JSON.stringify(data)}` };
      childIds.push(data.id);
    }

    // Step 2: Create carousel container
    const params = new URLSearchParams({
      caption,
      media_type: 'CAROUSEL',
      access_token: config.accessToken,
    });
    for (const id of childIds) {
      params.append('children', id);
    }

    const carouselRes = await fetch(`https://graph.instagram.com/v21.0/${config.userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const carouselData = await carouselRes.json();
    if (!carouselData.id) return { ok: false, error: JSON.stringify(carouselData) };

    // Step 3: Wait and publish
    await new Promise(r => setTimeout(r, 3000));

    const publishRes = await fetch(`https://graph.instagram.com/v21.0/${config.userId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: carouselData.id,
        access_token: config.accessToken,
      }),
    });
    const publishData = await publishRes.json();
    if (publishData.id) return { ok: true, mediaId: publishData.id };
    return { ok: false, error: JSON.stringify(publishData) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Unified Social Posting ───

export interface SocialPostRequest {
  text: string;
  platforms: ('x' | 'instagram' | 'tiktok' | 'all')[];
  scheduleAt?: string; // ISO date string
  postNow?: boolean;
  media?: { link?: string; photo?: string; imageUrl?: string };
}

export interface SocialPostResult {
  platform: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export async function postToSocial(req: SocialPostRequest): Promise<SocialPostResult[]> {
  const results: SocialPostResult[] = [];
  const platforms = req.platforms.includes('all') ? ['x', 'instagram'] : req.platforms;

  // X/Twitter — direct
  if (platforms.includes('x')) {
    const xText = req.text.length > 280 ? req.text.slice(0, 277) + '...' : req.text;
    const xResult = await postToX(xText);
    results.push({ platform: 'x', ok: xResult.ok, id: xResult.tweetId, error: xResult.error });
  }

  // Instagram — direct via Graph API
  if (platforms.includes('instagram')) {
    const imageUrl = req.media?.imageUrl || req.media?.photo;
    if (imageUrl) {
      const igResult = await postToInstagram(req.text, imageUrl);
      results.push({ platform: 'instagram', ok: igResult.ok, id: igResult.mediaId, error: igResult.error });
    } else {
      results.push({ platform: 'instagram', ok: false, error: 'Instagram requires an image URL. Skipped.' });
    }
  }

  // TikTok — not yet supported
  if (platforms.includes('tiktok')) {
    results.push({ platform: 'tiktok', ok: false, error: 'TikTok API posting not yet configured.' });
  }

  return results;
}
