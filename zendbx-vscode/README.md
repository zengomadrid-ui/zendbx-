# ZendBX VS Code Extension

Official VS Code extension for ZendBX - the modern Backend-as-a-Service platform.

## Features

- **Authentication**: Secure login with JWT-based authentication
- **Project Management**: Browse, create, and manage your ZendBX projects
- **Database Explorer**: View tables, run SQL queries, and manage your database
- **Storage Explorer**: Browse buckets and manage files
- **SQL Runner**: Execute SQL queries with results visualization
- **Status Bar**: Quick access to active project and connection status

## Installation

1. Install the extension from VS Code Marketplace
2. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Run `ZendBX: Login`
4. Enter your credentials
5. Start building!

## Usage

### Login
1. Click the ZendBX icon in the Activity Bar
2. Click the login button or run `ZendBX: Login`
3. Enter your email and password

### Select a Project
1. Browse your projects in the Projects view
2. Click on a project to activate it
3. The status bar will show the active project

### Run SQL Queries
1. Open Command Palette
2. Run `ZendBX: Open SQL Runner`
3. Write your query and click Execute

## Configuration

Configure the extension in VS Code settings:

- `zendbx.apiUrl`: ZendBX API URL (default: `http://localhost:8000`)
- `zendbx.autoRefresh`: Auto-refresh project data (default: `true`)

## Requirements

- VS Code 1.85.0 or higher
- Active ZendBX account

## Support

- [Documentation](https://zendbx.com/docs)
- [GitHub Issues](https://github.com/zendbx/vscode-extension/issues)

## License

MIT
