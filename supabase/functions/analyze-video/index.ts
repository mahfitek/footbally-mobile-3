// Also run: supabase functions deploy analyze-video
import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_IMAGE_LENGTH = 1000;
const RATE_LIMIT_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const SYSTEM_PROMPT = `Sen bir futbol performans analizi uzmanısın.
Görevin sadece gerçek futbol maç görüntülerini analiz etmek.

KESİN KURALLAR:
1. Görüntüde gerçek bir futbol sahnesi yoksa analiz YAPMA
2. Görüntüde futbolcu(lar) görünmüyorsa analiz YAPMA
3. Görüntü animasyon, oyun, karikatür ise analiz YAPMA
4. Görüntü düşük kaliteli veya bulanıksa uyar
5. Aynı görüntü için her zaman tutarlı sonuç ver
6. Skoru objektif kriterlere göre ver, rastgele verme`;

const USER_PROMPT = `Bu görüntüyü 3 aşamada analiz et:

AŞAMA 1 - DOĞRULAMA (önce bunu yap):
Şu soruları yanıtla:
- Görüntüde futbol sahnesi var mı? (evet/hayır)
- Görüntüde futbolcu(lar) görünüyor mu? (evet/hayır)
- Görüntü gerçek bir maçtan mı? (evet/hayır)
- Görüntü analiz için yeterince net mi? (evet/hayır)

Eğer yukarıdakilerden herhangi biri "hayır" ise:
{"valid": false, "reason": "NEDEN_GECERSIZ", "message": "Türkçe açıklama"}
döndür ve dur.

AŞAMA 2 - TUTARLILIK KONTROLÜ:
Aynı görüntü için her zaman aynı skoru ver.
Skoru şu kriterlere göre hesapla:
- Oyuncunun teknik becerisi görünüyor mu? (0-25 puan)
- Top kontrolü / pozisyon doğru mu? (0-25 puan)
- Taktiksel farkındalık var mı? (0-25 puan)
- Fiziksel görünüm / duruş (0-25 puan)

AŞAMA 3 - ANALİZ (sadece geçerli futbol görüntüsü için):
{
  "valid": true,
  "score": <toplam 0-100>,
  "confidence": <0-100, analizin güven skoru>,
  "playerComparison": "<benzer stil oyuncu - sadece gerçek futbolcular>",
  "position": "<görüntüden tahmin edilen pozisyon>",
  "strengths": ["<gözlemlenen güçlü yön 1>", "<2>", "<3>"],
  "improvements": ["<geliştirilecek alan 1>", "<2>", "<3>"],
  "trainings": ["<antrenman önerisi 1>", "<2>", "<3>"],
  "insight": "<genel değerlendirme>",
  "warning": "<varsa uyarı mesajı, yoksa null>"
}

SADECE JSON döndür.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Yetkilendirme gerekli' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image, type, storagePath } = await req.json();
    if (!image || type !== 'image') {
      return new Response(JSON.stringify({ error: 'image alanı gerekli' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (image.length < MIN_IMAGE_LENGTH) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Görüntü çok küçük veya bozuk. Lütfen tekrar deneyin.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
      .from('ai_video_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if (countError) {
      console.error('Rate limit check failed:', countError);
    } else if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Saatlik 3 analiz limitine ulaştınız. Premium ile sınırsız analiz yapın.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: 'image/jpeg', data: image } },
                { text: USER_PROMPT },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return new Response(JSON.stringify({ error: 'Analiz servisi şu anda kullanılamıyor' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Unexpected Gemini response:', rawText);
      return new Response(JSON.stringify({ error: 'Analiz sonucu okunamadı' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.valid === false) {
      return new Response(
        JSON.stringify({ valid: false, reason: parsed.reason, message: parsed.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResult = {
      valid: true,
      score: parsed.score,
      confidence: parsed.confidence,
      playerComparison: parsed.playerComparison,
      position: parsed.position,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      trainings: parsed.trainings,
      insight: parsed.insight,
      warning: parsed.warning ?? null,
    };

    const { error: insertError } = await supabase.from('ai_video_jobs').insert({
      user_id: user.id,
      video_url: storagePath ?? null,
      status: 'completed',
      result: analysisResult,
      confidence: analysisResult.confidence ?? null,
      created_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error('Failed to save analysis job:', insertError);
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('analyze-video error:', err);
    return new Response(JSON.stringify({ error: 'Beklenmeyen bir hata oluştu' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
