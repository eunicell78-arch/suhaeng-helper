# 📚 수행평가 리서치 도우미

학교 유형에 맞는 글쓰기 방향 5개 이상 + 공신력 있는 자료 20개를 AI가 추천해주는 웹앱입니다.

---

## 🚀 GitHub Pages 배포 방법 (5단계)

### 1단계 — 이 레포지토리를 내 GitHub에 올리기

```bash
# 새 레포 생성 후 (GitHub에서 suhaeng-helper 라는 이름으로 생성)
git init
git add .
git commit -m "첫 커밋"
git branch -M main
git remote add origin https://github.com/본인아이디/suhaeng-helper.git
git push -u origin main
```

### 2단계 — GitHub Secrets 설정

1. GitHub 레포 페이지 → **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Secrets and variables → Actions** 클릭
3. **New repository secret** 버튼으로 아래 두 개를 각각 추가:

| Secret 이름 | 값 |
|---|---|
| `VITE_API_KEY` | Anthropic API 키 (`sk-ant-...`) |
| `VITE_APP_PASSWORD` | 원하는 비밀번호 (예: `school2025`) |

> API 키 발급: https://console.anthropic.com/keys

### 3단계 — GitHub Pages 활성화

1. 레포 **Settings** → 왼쪽 **Pages** 클릭
2. **Source**를 `GitHub Actions`로 선택
3. 저장

### 4단계 — 배포 실행

`main` 브랜치에 코드를 push하면 자동으로 빌드 & 배포됩니다.
(Actions 탭에서 진행 상황 확인 가능)

### 5단계 — 접속 확인

배포 완료 후 아래 URL로 접속:
```
https://본인아이디.github.io/suhaeng-helper/
```

---

## 💻 로컬 개발

```bash
# 의존성 설치
npm install

# .env.example을 복사해서 .env 파일 만들기
cp .env.example .env
# .env 파일을 열고 실제 API 키와 비밀번호 입력

# 개발 서버 실행
npm run dev
```

---

## ⚠️ 보안 참고 사항

- API 키는 빌드 시 JavaScript 번들에 포함됩니다
- 비밀번호 게이트로 일반 접근을 차단하지만, 개발자 도구로 키 확인이 기술적으로 가능합니다
- **Anthropic 대시보드에서 월별 사용 한도를 설정하는 것을 권장합니다**
  → https://console.anthropic.com/settings/limits

---

## 📁 프로젝트 구조

```
suhaeng-helper/
├── .github/workflows/deploy.yml  # GitHub Actions 자동 배포
├── src/
│   ├── main.jsx                  # React 진입점
│   └── App.jsx                   # 메인 앱 (비밀번호 게이트 포함)
├── index.html
├── vite.config.js
├── package.json
├── .env.example                  # 로컬 개발용 환경변수 예시
└── .gitignore
```
