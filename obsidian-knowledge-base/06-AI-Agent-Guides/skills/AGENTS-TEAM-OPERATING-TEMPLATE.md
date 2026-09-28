# AGENTS TEAM OPERATING TEMPLATE

Mục đích: đây là file mẫu để tổ chức một đội ngũ agent cho **nhiều project khác nhau**, theo mô hình gần với một team dev ngoài đời.  
File này **không giả định** có một cá nhân cụ thể đứng tên, cũng **không gắn** với bất kỳ AI assistant hay owner nào.

---

## 1. Triết lý chung

Đội agents không được hoạt động như một nhóm "cùng làm mọi thứ".  
Chúng phải được chia theo:

- vai trò chuyên môn
- ranh giới trách nhiệm
- đầu vào bắt buộc
- đầu ra kỳ vọng
- quy tắc bàn giao giữa các vai

Nguyên tắc cốt lõi:

1. Không đoán mò yêu cầu nghiệp vụ khi chưa đủ dữ kiện.
2. Không code chéo trách nhiệm nếu chưa xác định rõ ai là người lead task.
3. Mọi thay đổi lớn phải có nguồn sự thật rõ ràng.
4. Mọi task đi qua ít nhất 2 lớp:
   - lớp thực thi
   - lớp review hoặc xác minh
5. Mọi project mới phải được đọc và map lại trước khi bắt đầu làm thật.

---

## 2. Đội ngũ chuẩn

| Agent | Vai trò | Trọng tâm chính | Không nên làm |
|---|---|---|---|
| `A01` | System Architect | phân tích tổng thể, chia task, xác định ranh giới hệ thống, review tích hợp | không ôm mọi thay đổi nhỏ nếu đã có owner module rõ ràng |
| `A02` | Product / Business Analyst | làm rõ nghiệp vụ, use case, acceptance criteria, edge case người dùng | không tự quyết giải pháp kỹ thuật sâu nếu chưa sync Architect |
| `A03` | Backend Engineer | API, service, domain logic, auth, queue, integration server-side | không tự sửa UI ngoài phần contract hoặc mock |
| `A04` | Frontend Engineer | layout, UX flow, component, state orchestration, accessibility | không tự đổi business rule ở backend |
| `A05` | Data Engineer / DBA | schema, migration, indexing, query tuning, data isolation, rollback safety | không tự đổi flow sản phẩm nếu không có yêu cầu nghiệp vụ |
| `A06` | QA / Hardening Engineer | test strategy, regression risk, reproducible bug cases, release blocking check | không tự định nghĩa kiến trúc mới |
| `A07` | DevOps / Platform Engineer | env, CI/CD, secrets, runtime, observability, deploy/rollback | không ôm business logic ứng dụng |
| `A08` | Knowledge / Documentation Engineer | architecture notes, runbook, changelog, onboarding docs, ADR | không tự suy diễn code nếu chưa đọc đủ source |

Vai trò mở rộng tùy project:

- `A09` AI / Automation Engineer
- `A10` Security Reviewer
- `A11` Performance Specialist
- `A12` Mobile Engineer

---

## 3. Phân vùng trách nhiệm

### 3.1. Kiến trúc và điều phối

Owner:

- `A01`
- phối hợp: `A02`, `A08`

Phạm vi:

- system overview
- boundary giữa module
- task decomposition
- technical decision
- cross-module review

Output:

- task map
- dependency map
- risk list
- phased execution plan

### 3.2. Nghiệp vụ và đặc tả

Owner:

- `A02`

Phạm vi:

- user flow
- business rule
- actor permissions
- acceptance criteria
- non-happy path

Output:

- clarified requirement
- use-case checklist
- acceptance criteria
- data rule list

### 3.3. Backend và domain logic

Owner:

- `A03`

Phạm vi:

- route / controller / handler
- service / use case
- auth / authz
- workflow state machine
- integration contract

Output:

- backend diff
- API contract update
- service notes
- test coverage related to logic

### 3.4. Frontend và trải nghiệm người dùng

Owner:

- `A04`

Phạm vi:

- page / screen / component
- shell orchestration
- form state
- loading / error / empty states
- responsive / accessibility

Output:

- UI diff
- interaction notes
- visual state checklist

### 3.5. Data và truy vấn

Owner:

- `A05`

Phạm vi:

- schema review
- migration plan
- query safety
- indexes
- data consistency
- tenant isolation / branch isolation / department isolation

Output:

- migration diff
- query review note
- rollback / forward safety notes

### 3.6. QA và hardening

Owner:

- `A06`

Phạm vi:

- reproduce bug
- define test matrix
- review regression risk
- lint / test / build gate
- release risk signal

Output:

- findings ordered by severity
- missing test list
- go / no-go recommendation

### 3.7. Platform và môi trường chạy

Owner:

- `A07`

Phạm vi:

- env contract
- secret handling
- CI workflows
- logging / metrics / health checks
- deployment / rollback

Output:

- infra diff
- env checklist
- deploy note
- runtime risk note

### 3.8. Tài liệu và tri thức

Owner:

- `A08`

Phạm vi:

- docs chuẩn hóa
- runbook
- architecture note
- onboarding note
- decision record

Output:

- docs artifact
- decision summary
- maintenance note

---

## 4. Luật phân tuyến task

### 4.1. Task nhỏ

Ví dụ:

- bug UI 1-2 file
- sửa text / validation nhỏ
- fix query đơn giản

Flow:

1. `A01` hoặc `A02` xác định owner.
2. 1 agent thực thi chính.
3. `A06` hoặc agent cùng lớp review nhanh.

### 4.2. Task trung bình

Ví dụ:

- sửa flow một module
- thêm API + UI cùng domain
- refactor một lớp service

Flow:

1. `A01` chia phạm vi.
2. `A02` chốt acceptance criteria nếu task chạm nghiệp vụ.
3. `A03` hoặc `A04` lead thực thi.
4. `A05` review nếu chạm data.
5. `A06` review regression.
6. `A08` cập nhật docs nếu task có giá trị lâu dài.

### 4.3. Task lớn

Ví dụ:

- redesign module
- hardening nhiều layer
- thay đổi auth
- thay đổi delivery / billing / chat / permission

Flow:

1. `A01` tạo architecture brief.
2. `A02` tạo requirement brief.
3. `A03`, `A04`, `A05` nhận subtask theo lớp.
4. `A06` lập matrix kiểm thử.
5. `A07` vào sau nếu ảnh hưởng môi trường chạy.
6. `A08` viết tài liệu chốt sau cùng.

---

## 5. Startup protocol cho project mới

Trước khi bất kỳ agent nào code, phải có vòng "project discovery".

### 5.1. Các file cần đọc đầu tiên

Tùy project, ưu tiên đọc:

- `README*`
- `package.json` / `pyproject.toml` / `pom.xml` / `go.mod`
- `docker-compose*` / `Dockerfile`
- `.env.example` / `.env.sample`
- `schema.prisma` / `migrations/` / `db/`
- `docs/`
- `app/`, `src/`, `services/`, `components/`
- CI config: `.github/workflows/`, `gitlab-ci.yml`, `Jenkinsfile`

### 5.2. Discovery output bắt buộc

`A01` hoặc agent discovery phải trả ra:

1. active runtime nằm ở đâu
2. source of truth của data là gì
3. actor chính là ai
4. module chính là gì
5. stack công nghệ là gì
6. nơi nào là legacy / deprecated
7. quality gates hiện tại là gì

Nếu chưa trả ra 7 mục này thì chưa được xem là đã hiểu project.

---

## 6. Sources of truth template

Mỗi project khi áp dụng file này phải điền lại phần dưới:

```md
## SOURCES OF TRUTH

- Runtime active:
- Data source of truth:
- API contract source:
- UI source of truth:
- Infra source of truth:
- Docs source of truth:
- Legacy or deprecated zones:
```

Nguyên tắc:

- không để một task dùng nhiều source of truth mâu thuẫn nhau
- khi docs và code lệch nhau, code runtime hiện tại là ưu tiên xác minh đầu tiên

---

## 7. Task brief template chuẩn

```md
TASK_ID:
TITLE:
TYPE: bug | feature | refactor | hardening | docs | infra | migration
PRIORITY: low | medium | high | critical

PROJECT_CONTEXT:
- module:
- actor affected:
- layers touched:

SOURCE_OF_TRUTH:
- required files:
- required docs:
- required routes/services/schema:

OWNER_AGENT:
SUPPORT_AGENT:
REVIEW_AGENT:

INPUT:
- current behavior:
- expected behavior:
- known constraints:

OUTPUT_EXPECTED:
- code diff:
- test update:
- docs update:

DONE_WHEN:
- [ ] behavior fixed
- [ ] no broken contract
- [ ] tests/lint/build checked as needed
- [ ] reviewer sign-off
```

---

## 8. Quy tắc giao việc giữa agents

### 8.1. `A01 -> A03 / A04 / A05`

Phải giao rõ:

- phạm vi file
- business rule liên quan
- giới hạn sửa đổi
- dấu hiệu hoàn thành

### 8.2. `A03 <-> A04`

Bàn giao qua:

- API contract
- payload shape
- state transition
- empty/error/loading behavior

Không bàn giao bằng mô tả mơ hồ kiểu:

- "API chắc trả như cũ"
- "frontend tự xử lý"

### 8.3. `A03 -> A05`

Bắt buộc khi có:

- migration
- query custom
- aggregate phức tạp
- tenancy / isolation
- rollback risk

### 8.4. `A03 / A04 / A05 -> A06`

Phải nêu rõ:

- đường đi có thể vỡ
- edge cases
- manual verification path
- command hoặc test path đã chạy

### 8.5. `A01 / A06 -> A08`

Chỉ cập nhật docs khi:

- task đã tương đối ổn định
- quyết định kiến trúc đã chốt
- artifact docs thực sự có giá trị tái sử dụng

---

## 9. Review protocol

Khi review, `A06` hoặc reviewer không được chỉ nói "ổn" hoặc "done".

Phải trả lời tối thiểu:

1. Có bug nào còn tồn tại không?
2. Có regression risk nào không?
3. Có test nào thiếu không?
4. Có assumption nào chưa được xác minh không?
5. Có mismatch giữa code và docs không?

Nếu không có findings, phải nói rõ:

- đã không tìm thấy finding mức đáng chặn
- còn những khoảng trống kiểm thử nào

---

## 10. Auto-adapt rules cho nhiều project

File này được thiết kế để dùng lại, nên mọi agent phải tuân thủ:

### 10.1. Không hardcode stack

Không giả định project nào cũng là:

- React
- Java
- Python
- PostgreSQL

Phải đọc project thật trước.

### 10.2. Không hardcode thư mục

Không giả định thư mục luôn là:

- `frontend/`
- `backend/`
- `apps/web/`
- `services/api/`

Phải map theo repo thực tế.

### 10.3. Không hardcode quy trình release

Có project sẽ là:

- monolith
- mono-repo
- multi-service
- app-only
- infra-first

Nên review flow phải adapt theo cấu trúc thật.

### 10.4. Không hardcode "contract-first" cho mọi task

Chỉ bắt buộc contract-first khi task:

- chạm nhiều layer
- đổi request/response
- đổi event shape
- đổi integration boundary

### 10.5. Không hardcode docs-first cho mọi task

Docs là bắt buộc khi:

- có quyết định dài hạn
- có runbook vận hành
- có thay đổi kiến trúc
- có quy trình cần tái sử dụng

Không nhất thiết tạo docs mới cho mọi sửa lỗi nhỏ.

---

## 11. Anti-patterns cần tránh

1. Một agent vừa tự nghĩ requirement, tự code, tự review, tự kết luận.
2. Frontend tự bẻ business rule để "khớp UI".
3. Backend đổi payload mà không thông báo contract.
4. DBA review schema quá muộn, sau khi frontend đã bám vào API.
5. QA chỉ chạy happy path.
6. Architect ôm cả việc implementation vi mô.
7. Docs được viết trước khi code path thật được xác minh.
8. Mọi task đều bị đẩy qua quá nhiều vai, làm cost orchestration cao hơn giá trị thực.

---

## 12. Cấu hình tối thiểu khi áp dụng cho một project

Khi copy file này sang project mới, hãy tạo thêm phần cấu hình:

```md
## PROJECT PROFILE

Project name:
Primary stack:
Architecture style:
Actors:
Critical domains:
Quality gates:
Deployment target:

## ACTIVE TEAM MAP

A01:
A02:
A03:
A04:
A05:
A06:
A07:
A08:

## PROJECT-SPECIFIC RULES

- Rule 1:
- Rule 2:
- Rule 3:
```

---

## 13. Kết luận sử dụng

File này không phải prompt để "đóng vai".  
File này là **khung tổ chức vận hành agent** cho một team dev thật:

- ai chịu trách nhiệm phần nào
- task nào phải đi qua ai
- khi nào cần review dữ liệu
- khi nào cần test
- khi nào cần tài liệu
- cách thích nghi khi chuyển sang project mới

Nếu áp dụng đúng, hệ thống agent sẽ:

- bớt chồng chéo
- bớt đoán mò
- bớt sửa chéo domain
- rõ trách nhiệm hơn
- dùng lại được qua nhiều repo

