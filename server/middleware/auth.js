import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fincontrol-secret-key-2024';

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : null);
  if (!header) return res.status(401).json({ error: 'Token não fornecido' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
