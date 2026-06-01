const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// 테스트용 비밀키 — 실제 서비스에서는 환경변수로 관리할 것
const JWT_SECRET = 'test-secret-change-me';
const TOKEN_EXPIRES_IN = '1h';

// DB 대신 메모리에 유저 저장 (서버 재시작 시 초기화됨)
const users = [];

// 회원가입
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username과 password는 필수입니다.' });
  }
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: '이미 존재하는 사용자입니다.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ username, passwordHash });
  res.status(201).json({ message: '회원가입 완료', username });
});

// 로그인 → JWT 발급
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
  res.json({ token });
});

// 인증 미들웨어 — Authorization: Bearer <token>
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '토큰이 없습니다.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

// 보호된 라우트 — 로그인한 유저만 접근 가능
app.get('/me', authenticate, (req, res) => {
  res.json({ username: req.user.username });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`인증 서버 실행 중: http://localhost:${PORT}`));
