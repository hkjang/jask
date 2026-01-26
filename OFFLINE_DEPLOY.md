# Offline Deployment Guide / 오프라인 배포 가이드

[English](#english) | [한국어](#korean)

---

<a name="english"></a>

## English

This guide describes how to deploy the JASK application in an offline environment (Network Isolated).

### Prerequisites

#### Local Machine (Internet Connected)

- Git
- Docker & Docker Compose
- PowerShell (Windows) or Bash (Linux/macOS)

#### Target Machine (Offline)

- Docker Engine (v20+)
- Docker Compose (v2+)
- Access to transfer files (USB, SCP, etc.)

### 1. Create Deployment Package (On Internet Connected Machine)

Run the export script to build Docker images and package them.

**For Windows (PowerShell):**

```powershell
.\scripts\export-images.ps1
```

**For Linux/macOS:**

```bash
chmod +x scripts/export-images.sh
./scripts/export-images.sh
```

This will create a compressed file named `jask-offline-v1.0.0.tar.gz`.

### 2. Transfer Package

Copy `jask-offline-v1.0.0.tar.gz` to the target offline server.

### 3. Install & Run (On Offline Machine)

1. **Extract the package:**

   ```bash
   tar -xzf jask-offline-v1.0.0.tar.gz
   cd jask-offline-v1.0.0
   ```

2. **Run the installation script:**
   The installation script will load valid Docker images, generate security keys, and apply database migrations.

   ```bash
   sudo ./install.sh
   ```

3. **Verify Deployment:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000/api

   The script waits for the database to be ready and automatically applies:
   - `prisma migrate deploy`: Database schema updates
   - `prisma db seed`: Initial data seeding (Admin User: `admin@jask.io` / `admin123`)

### Configuration (Ports & Secrets)

After running `./install.sh` first time, a `.env` file is generated. You can edit this file to change ports or secrets.

```bash
nano .env
```

**Example `.env`:**

```env
JWT_SECRET=...
NEXTAUTH_SECRET=...
# Ports Configuration
BACKEND_PORT=4007  # Change if 4000 is used
FRONTEND_PORT=3007 # Change if 3000 is used
```

Restart services to apply changes:

```bash
docker-compose up -d
```

### Oracle Database Compatibility

The system uses `node-oracledb` in **Thin Mode**, which offers significant advantages for offline deployment:

- **No Additional Installation**: It does NOT require Oracle Instant Client to be installed on the Docker image or the host machine.
- **Pure JavaScript/TypeScript**: Works immediately within the provided Alpine Linux based Docker image without missing library errors (`libaio`, etc.).

**Requirements:**

- **Oracle Database 12.1 or newer**: Thin Mode supports connection to Oracle Database 12c Release 1 (12.1) and later.
- **Limitations**: Connecting to very old Oracle versions (11gR2 or older) is **NOT supported** in this offline package configuration as it requires Thick Mode libraries which are not included to keep the image slim and compliant.

### Troubleshooting

- **Database Connection Error**: The install script waits for Postgres. If it fails, check `docker-compose logs postgres`.
- **Migration Failed**: If migrations fail, you can retry manually:
  ```bash
  docker exec -it jask-backend npx prisma migrate deploy
  ```
- **Secrets**: Passwords and secrets are generated in `.env`. Back up this file if needed.

---

<a name="korean"></a>

## 한국어 (Korean)

이 가이드는 인터넷이 차단된 오프라인(폐쇄망) 환경에서 JASK 애플리케이션을 배포하는 방법을 설명합니다.

### 사전 요구사항 (Prerequisites)

#### 로컬 머신 (인터넷 연결됨)

- Git
- Docker 및 Docker Compose
- PowerShell (Windows) 또는 Bash (Linux/macOS)

#### 타겟 머신 (오프라인 서버)

- Docker Engine (v20 이상)
- Docker Compose (v2 이상)
- 파일 전송 수단 (USB, SCP 등)

### 1. 배포 패키지 생성 (인터넷 연결된 PC에서 수행)

내보내기 스크립트를 실행하여 Docker 이미지를 빌드하고 패키징합니다.

**Windows (PowerShell) 사용 시:**

```powershell
.\scripts\export-images.ps1
```

**Linux/macOS 사용 시:**

```bash
chmod +x scripts/export-images.sh
./scripts/export-images.sh
```

스크립트가 완료되면 `jask-offline-v1.0.0.tar.gz` 라는 압축 파일이 생성됩니다.

### 2. 패키지 전송

생성된 `jask-offline-v1.0.0.tar.gz` 파일을 오프라인 서버로 복사합니다.

### 3. 설치 및 실행 (오프라인 서버에서 수행)

1. **패키지 압축 해제:**

   ```bash
   tar -xzf jask-offline-v1.0.0.tar.gz
   cd jask-offline-v1.0.0
   ```

2. **설치 스크립트 실행:**
   설치 스크립트는 Docker 이미지를 로드하고, 보안 키를 생성하며, DB 마이그레이션을 자동으로 수행합니다.

   ```bash
   sudo ./install.sh
   ```

3. **배포 확인:**
   - 프론트엔드: http://localhost:3000
   - 백엔드 API: http://localhost:4000/api

   스크립트는 데이터베이스 구동을 대기한 후 자동으로 다음 작업을 수행합니다:
   - `prisma migrate deploy`: 데이터베이스 스키마 생성/업데이트
   - `prisma db seed`: 초기 데이터(관리자 계정 등) 적재
     - 기본 관리자 계정: `admin@jask.io` / `admin123`

### 환경 설정 (포트 및 보안 키)

`./install.sh`를 최초 실행하면 `.env` 파일이 생성됩니다. 이 파일을 수정하여 포트나 보안 키를 변경할 수 있습니다.

```bash
nano .env
```

**설정 예시:**

```env
JWT_SECRET=...
NEXTAUTH_SECRET=...
# Ports Configuration
BACKEND_PORT=4007  # 4000번 포트 충돌 시 변경
FRONTEND_PORT=3007 # 3000번 포트 충돌 시 변경
```

변경 사항 적용을 위해 서비스를 재시작하세요:

```bash
docker-compose up -d
```

### 오라클 데이터베이스 호환성 (Oracle Compatibility)

본 시스템은 `node-oracledb`의 **Thin Mode**를 사용하여 오프라인 환경 배포에 최적화되어 있습니다.

- **추가 설치 불필요**: Oracle Instant Client와 같은 별도의 클라이언트 라이브러리 설치가 필요 없습니다.
- **즉시 실행 가능**: 제공된 Docker 이미지(Alpine Linux 기반) 내에서 추가적인 OS 라이브러리(`libaio` 등) 의존성 문제 없이 즉시 작동합니다.

**지원 버전 및 주의사항:**

- **Oracle Database 12.1 이상 지원**: Thin Mode는 Oracle 12c Release 1 (12.1) 이상 버전의 데이터베이스 접속만 지원합니다.
- **구버전 접속 불가**: Oracle 11gR2 이하의 구버전 데이터베이스는 이 오프라인 패키지 구성으로는 **접속할 수 없습니다.** (구버전 접속을 위해서는 별도의 Thick Mode 라이브러리 구성이 필요하며, 이는 현재 Alpine 이미지에 포함되어 있지 않습니다.)

### 문제 해결 (Troubleshooting)

- **데이터베이스 연결 오류**: 설치 스크립트는 Postgres가 준비될 때까지 기다립니다. 만약 실패한다면 로그를 확인하세요: `docker-compose logs postgres`
- **마이그레이션 실패**: 마이그레이션이 실패했다면 수동으로 다시 시도할 수 있습니다:
  ```bash
  docker exec -it jask-backend npx prisma migrate deploy
  ```
- **환경 변수 (Secrets)**: 비밀번호와 보안 키는 `.env` 파일에 자동으로 생성됩니다. 필요하다면 이 파일을 백업해두세요.
