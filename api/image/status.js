export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, available: false });
  }
  return res.status(200).json({
    ok: true,
    available: true,
  });
}
