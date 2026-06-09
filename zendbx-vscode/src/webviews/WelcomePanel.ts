import * as vscode from 'vscode';

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, _context: vscode.ExtensionContext) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlContent();

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'login':
            vscode.commands.executeCommand('zendbx.login');
            break;
          case 'createProject':
            vscode.commands.executeCommand('zendbx.createProject');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(context: vscode.ExtensionContext): void {
    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel._panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'zendbxWelcome',
      'Welcome to ZendBX',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, context);
  }

  public dispose(): void {
    WelcomePanel.currentPanel = undefined;
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
  <title>Welcome to ZendBX</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 40px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: var(--vscode-foreground);
      margin-bottom: 10px;
      font-size: 32px;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 30px;
      font-size: 16px;
    }
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background-color: var(--vscode-editor-lineHighlightBackground);
      border-radius: 8px;
    }
    h2 {
      color: var(--vscode-foreground);
      margin-bottom: 15px;
      font-size: 20px;
    }
    .action-buttons {
      margin-top: 20px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 14px;
      border-radius: 4px;
      margin-right: 10px;
      margin-bottom: 10px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 10px;
    }
    .feature-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .feature-item {
      padding: 15px;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
    }
    .feature-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    code {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to ZendBX</h1>
    <p class="subtitle">The modern Backend-as-a-Service platform for developers</p>

    <div class="section">
      <h2>Getting Started</h2>
      <p>Follow these simple steps to start building with ZendBX:</p>
      <ol>
        <li><strong>Login:</strong> Click the login button below to authenticate with your ZendBX account</li>
        <li><strong>Create or Select a Project:</strong> Create a new project or select an existing one from the Projects view</li>
        <li><strong>Start Building:</strong> Use the Database Explorer, SQL Runner, and Storage Explorer to manage your backend</li>
      </ol>
      <div class="action-buttons">
        <button id="loginBtn">Login to ZendBX</button>
        <button id="createProjectBtn">Create New Project</button>
      </div>
    </div>

    <div class="section">
      <h2>Features</h2>
      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-title">🗄️ Database</div>
          <p>Browse tables, run SQL queries, and manage your PostgreSQL database</p>
        </div>
        <div class="feature-item">
          <div class="feature-title">📁 Storage</div>
          <p>Upload, download, and manage files in cloud storage buckets</p>
        </div>
        <div class="feature-item">
          <div class="feature-title">🔐 Authentication</div>
          <p>Built-in auth system with JWT tokens and session management</p>
        </div>
        <div class="feature-item">
          <div class="feature-title">📊 SQL Runner</div>
          <p>Execute SQL queries with real-time results visualization</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Quick Commands</h2>
      <ul>
        <li><code>ZendBX: Login</code> - Authenticate with your account</li>
        <li><code>ZendBX: Create New Project</code> - Start a new project</li>
        <li><code>ZendBX: Open SQL Runner</code> - Execute SQL queries</li>
        <li><code>ZendBX: Open Dashboard</code> - View project in web dashboard</li>
      </ul>
    </div>

    <div class="section">
      <h2>Resources</h2>
      <ul>
        <li><a href="https://zendbx.com/docs" style="color: var(--vscode-textLink-foreground)">Documentation</a></li>
        <li><a href="https://zendbx.com/examples" style="color: var(--vscode-textLink-foreground)">Examples</a></li>
        <li><a href="https://github.com/zendbx" style="color: var(--vscode-textLink-foreground)">GitHub</a></li>
      </ul>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    document.getElementById('loginBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'login' });
    });

    document.getElementById('createProjectBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'createProject' });
    });
  </script>
</body>
</html>`;
  }
}
