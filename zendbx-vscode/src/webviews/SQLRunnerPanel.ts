import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { Logger } from '../utils/logger';

export class SQLRunnerPanel {
  public static currentPanel: SQLRunnerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private databaseService: DatabaseService;

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;
    this.databaseService = DatabaseService.getInstance(context);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlContent();

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'executeQuery':
            await this.executeQuery(message.sql);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(context: vscode.ExtensionContext): void {
    if (SQLRunnerPanel.currentPanel) {
      SQLRunnerPanel.currentPanel._panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'zendbxSQLRunner',
      'SQL Runner',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    SQLRunnerPanel.currentPanel = new SQLRunnerPanel(panel, context);
  }

  private async executeQuery(sql: string): Promise<void> {
    try {
      Logger.info(`Executing SQL: ${sql.substring(0, 100)}...`);

      const result = await this.databaseService.executeQuery(sql);

      if (!result) {
        this._panel.webview.postMessage({
          command: 'queryResult',
          error: 'Query execution failed',
        });
        return;
      }

      this._panel.webview.postMessage({
        command: 'queryResult',
        result: {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.row_count,
        },
      });

      // Refresh database explorer if it's a DDL query
      const sqlUpper = sql.trim().toUpperCase();
      if (
        sqlUpper.startsWith('CREATE TABLE') ||
        sqlUpper.startsWith('DROP TABLE') ||
        sqlUpper.startsWith('ALTER TABLE') ||
        sqlUpper.includes('CREATE TABLE') ||
        sqlUpper.includes('DROP TABLE')
      ) {
        Logger.info('DDL query detected, refreshing database explorer');
        vscode.commands.executeCommand('zendbx.refreshDatabase');
      }
    } catch (error) {
      Logger.error(`SQL execution error: ${error}`);
      this._panel.webview.postMessage({
        command: 'queryResult',
        error: String(error),
      });
    }
  }

  public dispose(): void {
    SQLRunnerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SQL Runner</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: var(--vscode-foreground);
      margin-bottom: 20px;
    }
    .editor-container {
      margin-bottom: 20px;
    }
    #sqlEditor {
      width: 100%;
      min-height: 200px;
      padding: 10px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      resize: vertical;
    }
    .button-container {
      margin-bottom: 20px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      border-radius: 4px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .results-container {
      margin-top: 20px;
    }
    .error {
      color: var(--vscode-errorForeground);
      background-color: var(--vscode-inputValidation-errorBackground);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .success {
      color: var(--vscode-foreground);
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      background-color: var(--vscode-editor-background);
    }
    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: var(--vscode-editor-lineHighlightBackground);
      font-weight: bold;
    }
    tr:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .loading {
      display: none;
      margin-top: 10px;
    }
    .loading.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SQL Runner</h1>
    
    <div class="editor-container">
      <textarea id="sqlEditor" placeholder="Enter your SQL query here...
Example: SELECT * FROM users LIMIT 10;"></textarea>
    </div>
    
    <div class="button-container">
      <button id="executeBtn">Execute Query</button>
      <button id="clearBtn">Clear</button>
    </div>
    
    <div class="loading" id="loading">Executing query...</div>
    
    <div class="results-container" id="results"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const executeBtn = document.getElementById('executeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sqlEditor = document.getElementById('sqlEditor');
    const results = document.getElementById('results');
    const loading = document.getElementById('loading');

    executeBtn.addEventListener('click', () => {
      const sql = sqlEditor.value.trim();
      if (!sql) {
        results.innerHTML = '<div class="error">Please enter a SQL query</div>';
        return;
      }

      loading.classList.add('active');
      results.innerHTML = '';
      
      vscode.postMessage({
        command: 'executeQuery',
        sql: sql
      });
    });

    clearBtn.addEventListener('click', () => {
      sqlEditor.value = '';
      results.innerHTML = '';
    });

    window.addEventListener('message', event => {
      const message = event.data;
      loading.classList.remove('active');

      if (message.command === 'queryResult') {
        if (message.error) {
          results.innerHTML = \`<div class="error">Error: \${message.error}</div>\`;
          return;
        }

        const result = message.result;
        let html = \`<div class="success">Query executed successfully. \${result.rowCount} row(s) returned.</div>\`;

        if (result.rows && result.rows.length > 0) {
          html += '<table>';
          html += '<thead><tr>';
          result.columns.forEach(col => {
            html += \`<th>\${col}</th>\`;
          });
          html += '</tr></thead>';
          html += '<tbody>';
          result.rows.forEach(row => {
            html += '<tr>';
            result.columns.forEach(col => {
              const value = row[col];
              html += \`<td>\${value !== null && value !== undefined ? value : 'NULL'}</td>\`;
            });
            html += '</tr>';
          });
          html += '</tbody>';
          html += '</table>';
        }

        results.innerHTML = html;
      }
    });
  </script>
</body>
</html>`;
  }
}
