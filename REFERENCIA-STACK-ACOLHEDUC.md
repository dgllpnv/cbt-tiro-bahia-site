# Referencia da Stack Acolheduc para o Projeto CBT

> Este documento registra toda a arquitetura, stack, APIs e padroes do projeto Acolheduc
> para ser replicada no Portal de Associados do CBT (Clube Baiano de Tiro).

---

## 1. VISAO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────┐
│                    MONOREPO                              │
│                                                         │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │   FRONTEND        │    │   BACKEND                 │  │
│  │   React + Vite    │───▶│   Express + TypeScript    │  │
│  │   Tailwind + SUI  │    │   Prisma + PostgreSQL     │  │
│  │   Deploy: Vercel  │    │   Deploy: Railway         │  │
│  │   Porta: 8080     │    │   Porta: 3001             │  │
│  └──────────────────┘    └───────────────────────────┘  │
│                                  │                       │
│                           ┌──────┴──────┐                │
│                           │ PostgreSQL  │                │
│                           │ Railway DB  │                │
│                           │ Porta: 5432 │                │
│                           └─────────────┘                │
└─────────────────────────────────────────────────────────┘
```

**Plataformas de Deploy:**
- Frontend: **Vercel** (free tier, regiao gru1 - Sao Paulo)
- Backend: **Railway** (hobby plan ~$5/mes)
- Banco de Dados: **PostgreSQL no Railway** (incluido)
- Media/Uploads: **Cloudinary** (free tier 25GB/mes)
- IA (opcional): **OpenAI API** (pay-as-you-go)

---

## 2. STACK COMPLETA DO FRONTEND

### Dependencias Principais (package.json)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "@tanstack/react-query": "^5.56.2",
    "axios": "^1.13.2",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "framer-motion": "^12.6.2",
    "tailwindcss": "^3.4.11",
    "tailwindcss-animate": "^1.0.7",
    "recharts": "^2.12.7",
    "lucide-react": "^0.462.0",
    "sonner": "^1.5.0",
    "date-fns": "^3.6.0",
    "jspdf": "^4.1.0",
    "jspdf-autotable": "^5.0.7",
    "canvas-confetti": "^1.9.4",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "class-variance-authority": "^0.7.1",
    "next-themes": "^0.3.0"
  },
  "devDependencies": {
    "vite": "^5.4.1",
    "@vitejs/plugin-react-swc": "^3.5.0",
    "typescript": "^5.5.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47"
  }
}
```

### shadcn/ui (Radix UI) - Componentes Instalados
Todos os componentes do shadcn/ui estao disponiveis: accordion, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toggle, toggle-group, tooltip.

### vite.config.ts
```typescript
export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [react()],  // @vitejs/plugin-react-swc
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  }
})
```

### Variavel de Ambiente Frontend
```
VITE_API_URL=http://localhost:3001          # desenvolvimento
VITE_API_URL=https://xxx.up.railway.app     # producao
```

Acesso no codigo: `import.meta.env.VITE_API_URL`

---

## 3. STACK COMPLETA DO BACKEND

### Dependencias (backend/package.json)
```json
{
  "dependencies": {
    "express": "^4.21.1",
    "@prisma/client": "^5.22.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "zod": "^3.23.8",
    "cors": "^2.8.5",
    "multer": "^2.0.2",
    "cloudinary": "^2.5.1",
    "openai": "^6.15.0",
    "date-fns": "^4.1.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "typescript": "^5.7.2",
    "tsx": "^4.19.2",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.12"
  }
}
```

### Scripts do Backend
```json
{
  "dev": "tsx watch src/index.ts",
  "start:prod": "tsx src/index.ts",
  "db:seed": "tsx prisma/seed.ts",
  "db:push": "npx prisma db push",
  "db:studio": "npx prisma studio"
}
```

---

## 4. ESTRUTURA DE PASTAS DO ACOLHEDUC

### Frontend (src/)
```
frontend/src/
├── main.tsx                          # Entry point
├── App.tsx                           # Providers + Routes
├── index.css                         # Tailwind + CSS vars
├── contexts/
│   ├── AuthContext.tsx                # Auth state + JWT
│   ├── ViewModeContext.tsx            # Toggle professor/coordenador
│   └── UserRoleContext.tsx            # Role context (legacy)
├── services/
│   ├── api.ts                        # Axios instance + interceptors
│   ├── authService.ts                # login/logout/getMe
│   ├── dashboardService.ts           # Dashboard data
│   ├── coordinatorDashboardService.ts
│   ├── studentsService.ts            # CRUD alunos
│   ├── observationsService.ts        # CRUD observacoes
│   ├── interventionsService.ts       # CRUD intervencoes
│   ├── evidencesService.ts           # CRUD evidencias + upload
│   ├── gradesService.ts              # CRUD notas
│   ├── lessonPlansService.ts         # CRUD planejamentos + workflow
│   ├── schedulesService.ts           # CRUD horarios
│   ├── usersService.ts               # CRUD usuarios (admin)
│   ├── aiService.ts                  # Geracao IA
│   ├── analyticsService.ts           # Analiticos
│   ├── pdfExportService.ts           # Exportacao PDF
│   └── saasService.ts                # SaaS operations
├── pages/
│   ├── LoginPage.tsx
│   ├── HomePage.tsx
│   ├── AdminPage.tsx
│   ├── AdminUsersPage.tsx
│   ├── PerfilPage.tsx
│   ├── RegistroAulaPage.tsx
│   ├── HistoricoRegistrosPage.tsx
│   ├── NotasPage.tsx
│   ├── PlanejamentoPage.tsx
│   ├── HorariosPage.tsx
│   ├── InterventionsDashboard.tsx
│   ├── EvidenciasPage.tsx
│   ├── NovaEvidenciaPage.tsx
│   ├── SaasDashboard.tsx
│   └── NotFound.tsx
├── components/
│   ├── auth/ProtectedRoute.tsx       # Protecao de rotas
│   ├── layout/                       # Header, NavMenu, etc
│   ├── dashboard/                    # Graficos, heatmaps
│   ├── admin/                        # Gestao usuarios/escola
│   ├── perfil/                       # Perfil aluno
│   ├── quick-register/               # Registro rapido
│   ├── horarios/                     # Grade horarios
│   ├── ai/                           # Assistente IA
│   └── ui/                           # shadcn/ui components
├── hooks/
│   ├── useStreak.tsx                 # Gamificacao
│   ├── use-mobile.tsx                # Responsividade
│   └── use-toast.ts                  # Notificacoes
├── lib/
│   └── utils.ts                      # cn() helper
└── utils/
    └── studentUtils.ts               # Utilidades aluno
```

### Backend
```
backend/
├── src/
│   ├── index.ts                      # Entry point Express
│   ├── middleware/
│   │   └── authMiddleware.ts         # JWT + RBAC + tenant filter
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── students.routes.ts
│   │   ├── observations.routes.ts
│   │   ├── interventions.routes.ts
│   │   ├── evidences.routes.ts
│   │   ├── grades.routes.ts
│   │   ├── lessonPlans.routes.ts
│   │   ├── schedules.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── analytics.routes.ts
│   │   ├── saas.routes.ts
│   │   └── teacherAssignments.routes.ts
│   ├── services/
│   │   ├── aiService.ts
│   │   ├── analyticsService.ts
│   │   └── riskCalculationService.ts
│   └── lib/
│       ├── prisma.ts                 # Prisma client singleton
│       ├── openai.ts                 # OpenAI client
│       └── cloudinary.ts             # Cloudinary config
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── seed.ts                       # Seed data
├── Dockerfile
└── package.json
```

---

## 5. AUTENTICACAO E AUTORIZACAO

### JWT Token
```typescript
// Geracao do token (backend)
const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
  JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Middleware de Auth (backend)
```typescript
// 1. authMiddleware - Verifica JWT
// Extrai token do header Authorization: Bearer <token>
// Valida assinatura, anexa user ao req

// 2. requireRole(...roles) - Controle de acesso
// Verifica se user.role esta na lista permitida
// Retorna 403 se nao autorizado

// 3. getTenantFilter(user) - Isolamento multi-tenant
// SUPER_ADMIN: retorna {} (ve tudo)
// Outros: retorna { schoolId: user.schoolId }
```

### Axios Interceptors (frontend)
```typescript
// Request: Injeta Authorization: Bearer {token} automaticamente
// Response 401: Limpa tokens + redireciona para /login
// Response 403: Mensagem de permissao negada
```

### LocalStorage Keys
```
acolheduc_auth_token    # JWT token
acolheduc_auth_user     # User data JSON
acolheduc_view_mode     # teacher | coordinator
acolheduc_streak        # Streak count
acolheduc_last_activity # Last activity date
```

### Hierarquia de Roles
```
SUPER_ADMIN  → Acesso global, gerencia escolas (sem schoolId)
ADMIN        → Administrador da escola, gerencia usuarios
COORDINATOR  → Coordenador, aprova planejamentos, ve todos os dados
TEACHER      → Professor, registra observacoes, cria planejamentos
```

### Mapeamento Backend → Frontend
```
SUPER_ADMIN / ADMIN → 'admin'
COORDINATOR         → 'coordinator'
TEACHER             → 'teacher'
```

---

## 6. BANCO DE DADOS (PRISMA + POSTGRESQL)

### Schema Prisma - Modelos Principais

```prisma
model School {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  logoUrl   String?  @db.Text
  domain    String?
  settings  Json?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // Relations: users, students, observations, etc.
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  login        String?  @unique
  passwordHash String   @db.Text
  role         Role     // SUPER_ADMIN, ADMIN, COORDINATOR, TEACHER
  fullName     String
  discipline   String?
  avatarUrl    String?  @db.Text
  phone        String?
  isActive     Boolean  @default(true)
  metadata     Json?
  schoolId     String?
  school       School?  @relation(fields: [schoolId], references: [id])
}

model Student {
  id              String         @id @default(uuid())
  schoolId        String
  name            String
  className       String
  educationLevel  EducationLevel // INFANTIL, FUNDAMENTAL1, FUNDAMENTAL2, MEDIO
  age             Int?
  dateOfBirth     DateTime?      @db.Date
  enrollmentNumber String?
  guardianName    String?
  guardianPhone   String?
  guardianEmail   String?
  specialNeeds    String?        @db.Text
  metadata        Json?
  isActive        Boolean        @default(true)
}

model Observation {
  id                 String          @id @default(uuid())
  schoolId           String
  studentId          String
  authorId           String
  observationDate    DateTime        @db.Date
  participationScore Int             // 1-5
  behaviorScore      Int?            // 1-5
  comprehensionScore Int?            // 1-5
  interestLevel      InterestLevel   // HIGH, PARTIAL, LOW
  interactionType    InteractionType // POSITIVE, NEUTRAL, NEGATIVE
  notes              String?         @db.Text
  autoSummary        String?         @db.Text
  flags              Json?
  @@unique([studentId, authorId, observationDate])
}

model Intervention {
  id                 String         @id @default(uuid())
  schoolId           String
  studentId          String
  authorId           String
  strategyType       StrategyType   // GAMIFICATION, MENTORSHIP, etc.
  status             InterventionStatus // PLANNED, ACTIVE, COMPLETED, CANCELLED
  title              String
  description        String?        @db.Text
  expectedDuration   Int?           // dias
  startDate          DateTime?      @db.Date
  endDate            DateTime?      @db.Date
  outcome            String?        @db.Text
  effectivenessScore Int?           // 1-5
  metadata           Json?
}

model LessonPlan {
  id             String           @id @default(uuid())
  schoolId       String
  authorId       String
  reviewerId     String?
  title          String
  className      String
  educationLevel EducationLevel?
  subject        String?
  weekStartDate  DateTime         @db.Date
  weekEndDate    DateTime         @db.Date
  content        Json             // {objetivos, metodologia, recursos, avaliacao, observacoes}
  bnccCodes      String[]
  status         LessonPlanStatus // DRAFT, SUBMITTED, APPROVED, REJECTED, CHANGES_REQUESTED, ARCHIVED
  reviewNotes    String?          @db.Text
  submittedAt    DateTime?
  reviewedAt     DateTime?
}

model Grade {
  id        String   @id @default(uuid())
  schoolId  String
  studentId String
  teacherId String
  subject   String
  trimester Int      // 1-3
  year      Int
  score     Decimal  @db.Decimal(4, 1) // 0.0 - 10.0
  notes     String?  @db.Text
  @@unique([studentId, subject, trimester, year])
}

model Schedule {
  id        String  @id @default(uuid())
  schoolId  String
  teacherId String?
  className String
  subject   String
  weekday   Weekday // MONDAY-FRIDAY
  startTime String  // HH:mm
  endTime   String  // HH:mm
  classroom String?
  notes     String? @db.Text
  isActive  Boolean @default(true)
}

model Evidence {
  id          String    @id @default(uuid())
  schoolId    String
  studentId   String?
  authorId    String
  title       String
  description String?   @db.Text
  mediaUrl    String?   @db.Text
  mediaType   MediaType // IMAGE, VIDEO, AUDIO, DOCUMENT
  bnccTags    String[]
  activityDate DateTime? @db.Date
  isPublic    Boolean   @default(false)
  metadata    Json?
}

model Notification {
  id       String           @id @default(uuid())
  schoolId String
  userId   String
  type     NotificationType // ALERT, APPROVAL_REQUEST, REMINDER, SYSTEM, ACHIEVEMENT
  title    String
  message  String?          @db.Text
  link     String?          @db.Text
  isRead   Boolean          @default(false)
}

model TeacherClassAssignment {
  id        String @id @default(uuid())
  schoolId  String
  teacherId String
  className String
  @@unique([teacherId, className])
}

model AIPrompt {
  id          String         @id @default(uuid())
  schoolId    String?
  authorId    String?
  title       String
  description String?        @db.Text
  category    PromptCategory // REPORTS, LESSON_PLANS, ACTIVITIES, BULLETINS, OTHER
  template    String         @db.Text
  isPublic    Boolean        @default(true)
  usageCount  Int            @default(0)
  metadata    Json?
}
```

### Enums
```prisma
enum Role { SUPER_ADMIN  ADMIN  COORDINATOR  TEACHER }
enum EducationLevel { INFANTIL  FUNDAMENTAL1  FUNDAMENTAL2  MEDIO }
enum InterestLevel { HIGH  PARTIAL  LOW }
enum InteractionType { POSITIVE  NEUTRAL  NEGATIVE }
enum StrategyType { GAMIFICATION  MENTORSHIP  PERSONAL_PROJECT  FAMILY_MEETING  TUTORING  OTHER }
enum InterventionStatus { PLANNED  ACTIVE  COMPLETED  CANCELLED }
enum LessonPlanStatus { DRAFT  SUBMITTED  APPROVED  REJECTED  CHANGES_REQUESTED  ARCHIVED }
enum MediaType { IMAGE  VIDEO  AUDIO  DOCUMENT }
enum NotificationType { ALERT  APPROVAL_REQUEST  REMINDER  SYSTEM  ACHIEVEMENT }
enum Weekday { MONDAY  TUESDAY  WEDNESDAY  THURSDAY  FRIDAY }
enum PromptCategory { REPORTS  LESSON_PLANS  ACTIVITIES  BULLETINS  OTHER }
```

---

## 7. API ENDPOINTS COMPLETOS

### Autenticacao (`/api/auth`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| POST | `/api/auth/login` | Nao | Login (email/login + password) → JWT token |
| POST | `/api/auth/logout` | Sim | Logout (client-side token removal) |
| GET | `/api/auth/me` | Sim | Dados do usuario autenticado |

### Usuarios (`/api/users`)
| Metodo | Rota | Auth | Roles | Descricao |
|--------|------|------|-------|-----------|
| GET | `/api/users` | Sim | ADMIN, COORD | Lista usuarios (paginado) |
| GET | `/api/users/:id` | Sim | ADMIN, COORD | Detalhes usuario |
| POST | `/api/users` | Sim | ADMIN, COORD | Criar usuario |
| PUT | `/api/users/:id` | Sim | ADMIN | Atualizar usuario |
| PUT | `/api/users/:id/password` | Sim | Self/ADMIN | Alterar senha |
| DELETE | `/api/users/:id` | Sim | ADMIN | Soft delete |

### Alunos (`/api/students`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/students` | Sim | Lista (filtros: className, educationLevel, search) |
| GET | `/api/students/:id` | Sim | Detalhes + observacoes recentes |
| POST | `/api/students` | Sim | Criar aluno |
| POST | `/api/students/import` | Sim | Importacao em massa |
| PUT | `/api/students/:id` | Sim | Atualizar |
| DELETE | `/api/students/:id` | Sim | Soft delete |

### Observacoes (`/api/observations`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/observations` | Sim | Lista (filtros: studentId, dateRange) |
| POST | `/api/observations` | Sim | Criar observacao |
| POST | `/api/observations/batch` | Sim | Registro em massa (sala inteira) |
| PUT | `/api/observations/:id` | Sim | Atualizar |
| DELETE | `/api/observations/:id` | Sim | Deletar |

### Intervencoes (`/api/interventions`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/interventions` | Sim | Lista (filtros: studentId, status, strategyType) |
| POST | `/api/interventions` | Sim | Criar |
| PUT | `/api/interventions/:id` | Sim | Atualizar |
| PATCH | `/api/interventions/:id/status` | Sim | Mudar status (workflow) |
| DELETE | `/api/interventions/:id` | Sim | Deletar (so PLANNED) |

### Notas (`/api/grades`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/grades` | Sim | Lista (filtros: studentId, subject, trimester, year) |
| POST | `/api/grades` | Sim | Criar nota |
| POST | `/api/grades/batch` | Sim | Notas em massa |
| PUT | `/api/grades/:id` | Sim | Atualizar |
| DELETE | `/api/grades/:id` | Sim | Deletar |

### Planejamentos (`/api/lesson-plans`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/lesson-plans` | Sim | Lista (filtros: status, className) |
| POST | `/api/lesson-plans` | Sim | Criar (status: DRAFT) |
| PUT | `/api/lesson-plans/:id` | Sim | Atualizar |
| PATCH | `/api/lesson-plans/:id/status` | Sim | Workflow: submit/approve/reject |
| DELETE | `/api/lesson-plans/:id` | Sim | Deletar |

### Horarios (`/api/schedules`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/schedules` | Sim | Lista |
| POST | `/api/schedules` | Sim | Criar |
| PUT | `/api/schedules/:id` | Sim | Atualizar |
| DELETE | `/api/schedules/:id` | Sim | Deletar |

### Evidencias (`/api/evidences`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/evidences` | Sim | Lista |
| POST | `/api/evidences` | Sim | Criar |
| POST | `/api/evidences/upload` | Sim | Upload media (Cloudinary) |
| PUT | `/api/evidences/:id` | Sim | Atualizar |
| DELETE | `/api/evidences/:id` | Sim | Deletar + remover Cloudinary |

### Dashboard (`/api/dashboard`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/dashboard/summary` | Sim | Resumo semanal do professor |
| GET | `/api/dashboard/coordinator` | Sim | Dashboard coordenador |

### Analytics (`/api/analytics`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/analytics/risk-assessment` | Sim | Alunos em risco |
| GET | `/api/analytics/student-progress` | Sim | Progresso aluno |
| GET | `/api/analytics/class-overview` | Sim | Visao geral turma |
| GET | `/api/analytics/teacher-stats` | Sim | Estatisticas professor |

### SaaS (`/api/saas`) - Somente SUPER_ADMIN
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| POST | `/api/saas/schools` | Sim | Criar escola (tenant) |
| GET | `/api/saas/schools` | Sim | Listar escolas |
| GET | `/api/saas/schools/:id` | Sim | Detalhes escola |
| PUT | `/api/saas/schools/:id` | Sim | Atualizar escola |
| PUT | `/api/saas/schools/:id/activate` | Sim | Ativar/desativar |
| POST | `/api/saas/schools/:id/admin` | Sim | Criar admin da escola |
| GET | `/api/saas/stats` | Sim | Estatisticas globais |

### Health Check
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/health` | Nao | Status do servidor + banco |

---

## 8. PADRAO DE RESPOSTA DA API

### Sucesso
```json
{
  "success": true,
  "data": { /* payload */ },
  "message": "Mensagem opcional",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Erro
```json
{
  "success": false,
  "error": "Mensagem de erro",
  "details": [ /* Zod validation errors */ ]
}
```

---

## 9. PADRAO DOS SERVICES (FRONTEND)

### api.ts - Axios Instance
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor: injeta Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('acolheduc_auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: trata 401, 403, etc.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('acolheduc_auth_token');
      localStorage.removeItem('acolheduc_auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Padrao de Service Function
```typescript
export const listarItens = async (filtros?: Filtros) => {
  try {
    const response = await api.get('/api/itens', { params: filtros });
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao listar itens'
    };
  }
};
```

---

## 10. PADRAO DE CONTEXTO (FRONTEND)

```typescript
interface MeuContextType {
  valor: string;
  setValor: (v: string) => void;
}

const MeuContext = createContext<MeuContextType | undefined>(undefined);

export const MeuProvider = ({ children }: { children: React.ReactNode }) => {
  const [valor, setValor] = useState('');
  return (
    <MeuContext.Provider value={{ valor, setValor }}>
      {children}
    </MeuContext.Provider>
  );
};

export const useMeuContext = () => {
  const context = useContext(MeuContext);
  if (!context) throw new Error('useMeuContext deve estar dentro de MeuProvider');
  return context;
};
```

---

## 11. PROTECAO DE ROTAS (FRONTEND)

```typescript
// ProtectedRoute.tsx
interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  return children;
};

// Uso no App.tsx
<Route path="/admin" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminPage />
  </ProtectedRoute>
} />
```

---

## 12. DOCKER COMPOSE

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:18-alpine
    container_name: acolheduc-postgres
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: acolheduc
      POSTGRES_DB: acolheduc
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: acolheduc-backend
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:acolheduc@postgres:5432/acolheduc
      JWT_SECRET: secret-key
      PORT: 3001
      NODE_ENV: development
      ALLOWED_ORIGINS: http://localhost:5174,http://localhost:8080
    command: >
      sh -c "npx prisma generate &&
             npx prisma db push --accept-data-loss &&
             npm run db:seed || true &&
             npm run dev"

  frontend:
    build: .
    container_name: acolheduc-frontend
    ports:
      - "5174:8080"
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:3001

volumes:
  postgres_data:

networks:
  default:
    name: acolheduc-network
```

---

## 13. DOCKERFILE BACKEND

```dockerfile
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "run", "dev"]
```

---

## 14. VERCEL.JSON (FRONTEND)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "regions": ["gru1"],
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

---

## 15. VARIAVEIS DE AMBIENTE COMPLETAS

### Backend (.env)
```bash
# Banco de dados
DATABASE_URL=postgresql://postgres:acolheduc@localhost:5433/acolheduc
DIRECT_URL=postgresql://postgres:acolheduc@localhost:5433/acolheduc

# Autenticacao
JWT_SECRET=gerar-com-crypto-randomBytes-64-hex
JWT_EXPIRES_IN=7d

# Servidor
PORT=3001
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173,http://localhost:5174

# OpenAI (opcional)
OPENAI_API_KEY=sk-proj-...
OPENAI_PROJECT_ID=proj_...

# Cloudinary (opcional)
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
```

### Producao
```bash
# Railway Backend
DATABASE_URL=postgresql://postgres:xxx@city.proxy.rlwy.net:PORT/railway
JWT_SECRET=chave-segura-producao
NODE_ENV=production
ALLOWED_ORIGINS=https://seu-app.vercel.app

# Vercel Frontend
VITE_API_URL=https://seu-backend.up.railway.app
```

---

## 16. ENTRY POINT DO BACKEND (index.ts)

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';

// Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import studentsRoutes from './routes/students.routes';
// ... mais rotas

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request logging (dev only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: 'Server is healthy', database: 'connected' });
  } catch {
    res.status(500).json({ success: false, database: 'disconnected' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/students', studentsRoutes);
// ... mais rotas

// Error handler global
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 17. PROVIDERS NO APP.TSX (FRONTEND)

```tsx
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ViewModeProvider>
        <StreakProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={
                  <ProtectedRoute><HomePage /></ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPage />
                  </ProtectedRoute>
                } />
                {/* ... mais rotas protegidas */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </StreakProvider>
      </ViewModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

---

## 18. MULTI-TENANCY

Cada registro no banco tem `schoolId`. O filtro e aplicado automaticamente:

```typescript
// Backend middleware
export function getTenantFilter(user: any) {
  if (user.role === 'SUPER_ADMIN') return {};
  return { schoolId: user.schoolId };
}

// Uso nas queries
const items = await prisma.model.findMany({
  where: {
    ...getTenantFilter(req.user),
    // outros filtros
  }
});
```

---

## 19. SENHA E SEGURANCA

```typescript
// Hash (criacao/update)
import bcrypt from 'bcryptjs';
const passwordHash = await bcrypt.hash(senha, 10);

// Verificacao (login)
const isValid = await bcrypt.compare(senhaInput, user.passwordHash);
```

---

## 20. CREDENCIAIS PADRAO (SEED)

| Role | Login | Senha |
|------|-------|-------|
| Super Admin | superadmin | superadmin |
| Admin | admin | admin |
| Coordenador | coordenador | coordenador |
| Professor 1 | professor | professor |
| Professor 2 | professor2 | professor2 |

---

## 21. CUSTOS ESTIMADOS (PRODUCAO)

| Servico | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby (Free) | R$ 0 |
| Railway | Hobby | ~R$ 25/mes ($5) |
| Cloudinary | Free | R$ 0 (25GB/mes) |
| OpenAI | Pay-as-you-go | ~R$ 0.05-0.50/request |
| **Total** | | **~R$ 25/mes** |

---

## 22. CHECKLIST PARA REPLICAR NO CBT

### Infraestrutura
- [ ] Criar repositorio GitHub
- [ ] Criar projeto Railway (PostgreSQL + Backend)
- [ ] Criar projeto Vercel (Frontend)
- [ ] Habilitar TCP Proxy no PostgreSQL Railway
- [ ] Configurar variaveis de ambiente

### Backend
- [ ] Criar pasta `backend/` com Express + TypeScript
- [ ] Configurar Prisma com schema do CBT
- [ ] Implementar autenticacao JWT (copiar padrao auth.routes)
- [ ] Implementar middleware RBAC (copiar authMiddleware)
- [ ] Implementar rotas CRUD
- [ ] Criar seed.ts com dados iniciais
- [ ] Configurar Dockerfile
- [ ] Configurar CORS

### Frontend
- [ ] Adaptar tema (laranja/dark do CBT no lugar de roxo do Acolheduc)
- [ ] Criar AuthContext (copiar padrao)
- [ ] Criar api.ts com interceptors (copiar padrao)
- [ ] Criar services para cada entidade
- [ ] Criar paginas (Login, Dashboard Admin, Perfil Associado)
- [ ] Implementar ProtectedRoute
- [ ] Configurar vercel.json

### Deploy
- [ ] Push para GitHub
- [ ] Deploy backend no Railway
- [ ] Deploy frontend na Vercel
- [ ] Testar health check
- [ ] Testar login
- [ ] Configurar dominio custom (opcional)
