import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# Get database URL from the environment variable
DATABASE_URL = os.getenv("DATABASE_CONNECTION_STRING")

# Create SQLAlchemy engine.
# pool_pre_ping validates a connection before handing it out, and pool_recycle
# proactively replaces ones older than 5 minutes. Both are required for serverless
# Postgres (Neon), which silently drops idle connections — without these the first
# query after an idle period crashes with "server closed the connection unexpectedly".
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    # The dashboard fans out ~10+ requests at once; a bigger pool keeps them from
    # queueing behind the default 5 connections (+10 overflow).
    pool_size=15,
    max_overflow=15,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 