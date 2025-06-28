# 🧾 excelToXml

A Node.js + TypeScript-based automation tool that reads structured data from an Excel file and generates Liquibase-compatible XML change sets. It supports GitHub integration to automatically commit the generated XML files to a new branch and open a pull request for review.

---

## 🚀 What This Project Does

This tool streamlines the process of converting business-logic-driven Excel templates into **Liquibase XML changelogs**. It's built for teams who:

- Regularly onboard data via Excel templates.
- Use Liquibase for DB migrations.
- Want to automate PR creation with the output.

### ✅ Features

- Parses Excel (.xlsx) files using custom validation.
- Generates one or more Liquibase XML changelog files.
- Auto-commits the output to a new GitHub branch.
- Automatically opens a pull request to the main repository.
- Validates data types and formats before processing.
- Logs meaningful validation and runtime errors.

---

## 📦 Tech Stack & Libraries Used

| Tool/Library         | Purpose                                |
|----------------------|----------------------------------------|
| `TypeScript`         | Type safety and cleaner codebase       |
| `Express.js`         | Lightweight server to accept uploads   |
| `exceljs`            | Parse Excel files                      |
| `zod`                | Input validation and schema definition |
| `xmlbuilder2`        | Generate Liquibase-compatible XML      |
| `fs-extra`           | File system operations                 |
| `simple-git`         | Local Git operations                   |
| `@octokit/rest`      | GitHub API wrapper for PR automation   |
| `dotenv`             | Environment variable management        |
| `multer`             | Middleware for handling file uploads   |

---

## 🛠️ Project Structure

```
excelToXml/
│
├── src/
│   ├── parser/          # Excel reading and validation
│   ├── generator/       # XML generation
│   ├── git/             # Git & PR automation
│   ├── validation/      # Zod schemas
│   ├── types/           # Type definitions
│   └── server.ts        # Express server
│
├── uploads/             # Temporary uploaded Excel files
├── output/              # Final generated XML files
├── .env                 # Environment config (token, etc.)
├── package.json
└── README.md
```

---

## 🧪 How to Run the Workflow Locally

### 1. 🧰 Prerequisites

- Node.js >= 18
- GitHub token with `repo` scope
- A GitHub repository with appropriate permissions

### 2. 📦 Installation

```bash
git clone https://github.com/<your-username>/excelToXml.git
cd excelToXml
npm install
```

### 3. ⚙️ Environment Setup

Create a `.env` file:

```env
GITHUB_TOKEN=ghp_xxxYourTokenHere
```

> Ensure this token has permission to push branches and create PRs.

### 4. 🚀 Start the Server

```bash
npm run dev
```

By default, the server runs at `http://localhost:3000`.

### 5. 🗂️ Upload Excel

Use Postman or curl:

```bash
curl -X POST http://localhost:3000/upload   -F "file=@./path/to/your/excel-file.xlsx"
```

This will:

- Validate and parse the Excel file.
- Generate XML(s) in the `output/` folder.
- Create a `uploads/` copy.
- Push files to a new branch in GitHub.
- Open a PR to `master`.

---

## 💡 Tips

- Keep your Excel files aligned with the expected schema (`formName`, `formNbr`, `recpType`, `srtKey`, etc.).
- On validation failure, meaningful errors will be logged, e.g., missing fields or invalid formats.
- The tool supports multiple XML file generation from a single Excel, each mapped to a separate Liquibase changeset.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you would like to change or improve.

---

## 📄 License

MIT © 2025 Mehrotra01
