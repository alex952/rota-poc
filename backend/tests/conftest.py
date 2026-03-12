import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import get_db
from app.main import app
from app.models.db_models import Base

# Use SQLite in-memory for tests to avoid requiring PostgreSQL.
# StaticPool ensures all connections share the same in-memory database.
TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# Enable foreign key support in SQLite (off by default)
@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI test client with overridden DB dependency."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def sample_pool():
    """Sample doctor pool for testing."""
    return [
        {"id": "doc-001", "name": "Dr. Garcia", "department": "Medicina General"},
        {"id": "doc-002", "name": "Dr. Lopez", "department": "Pediatria"},
        {"id": "doc-003", "name": "Dr. Martinez", "department": "Cardiologia"},
    ]
