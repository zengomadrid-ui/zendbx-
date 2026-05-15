"""Setup script for ZenDBX CLI"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

setup(
    name="zendbx",
    version="0.1.0",
    description="AI-powered PostgreSQL CLI for developers - Query fails, ZenDBX fixes it",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="ZenDBX Team",
    author_email="hello@zendbx.com",
    url="https://github.com/zendbx/cli",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "typer[all]>=0.9.0",
        "rich>=13.7.0",
        "asyncpg>=0.29.0",
        "psycopg2-binary>=2.9.9",
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "python-dotenv>=1.0.0",
        "pyyaml>=6.0.1",
        "click>=8.1.7",
        "httpx>=0.26.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.3",
            "pytest-asyncio>=0.23.2",
            "pytest-cov>=4.1.0",
            "black>=23.12.1",
            "ruff>=0.1.9",
            "mypy>=1.8.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "zendbx=zendbx.cli:app",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Database",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    keywords="postgresql database cli sql autofix developer-tools",
)
