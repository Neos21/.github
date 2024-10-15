#!/usr/bin/env node

// ================================================================================
// Create GitHub Repository And Templates
// ================================================================================

const fs    = require('fs/promises');
const https = require('https');
const path  = require('path');

const execAsync = require('util').promisify(require('child_process').exec);


// Environment Variable
// ================================================================================

/**
 * @type {string | undefined} GitHub Token
 * 
 * - `$ curl -s -H 'Authorization: Bearer 【Token】' https://api.github.com/users/codertocat -I | grep -i 'scope'` To Check Scopes
 * - https://docs.github.com/ja/developers/apps/building-oauth-apps/scopes-for-oauth-apps
 */
const ghToken = process.env['GH_TOKEN'];


// Utils
// ================================================================================

/** @type {IncomingHttpHeaders} Base Headers */
const baseHeaders = (() => {
  const headers = {
    'User-Agent': 'Awesome-Octocat-App',  // Some UA is Required
    'Accept'    : 'application/json'      // https://docs.github.com/ja/rest/overview/media-types
  };
  if(ghToken) headers['Authorization'] = `Bearer ${ghToken}`;  // 'Bearer' or 'token'
  return headers;
})();

/**
 * Is String
 * 
 * @param {*} value Value
 * @return {boolean} `true` If `value` is a String
 */
const isString = value => Object.prototype.toString.call(value) === '[object String]';

/**
 * Check Is File Exist
 * 
 * @param {string} filePath File Path
 * @return {Promise<boolean>} `true` If the file is already exist
 */
const isFileExist = async filePath => await fs.stat(filePath).then(() => true).catch(() => false);

/**
 * Read Text
 * 
 * @param {string} message Prompt Message
 * @return {Promise<string>} User Input
 */
const readText = async (message = 'Please Input') => {
  process.stdout.write(`${message} > `);
  process.stdin.resume();
  let text = '';
  try {
    text = await new Promise(resolve => process.stdin.once('data', resolve));
  }
  finally {
    process.stdin.pause();
  }
  return text.toString().trim();
};

/**
 * Request
 * 
 * @param {string} url URL
 * @param {RequestOptions} options Request Options
 * @param {string | undefined} body Request Body
 * @return {Promise<{ res: Response; data: string; }} Response
 * @throws Request Error or Timeout
 */
const request = (url, options = {}, body) => new Promise((resolve, reject) => {
  const req = https.request(url, options, res => {  // `http://` Does Not Supported (Requires `http` Module)
    res.setEncoding('utf8');
    let data = '';
    res.on('data', chunk => { data += chunk; })
       .on('end' , ()    => { resolve({ res, data }); });
  }).on('error'  , error => { reject(error); })
    .on('timeout', ()    => { req.destroy(); reject('Request Timeout'); })
    .setTimeout(10000);
  if(body) req.write(body);
  req.end();
});

/**
 * Execute Command
 * 
 * @param {string} command Command
 * @param {string} cwd Current Working Directory
 * @return {Promise<string>} Result
 * @throws Invalid Arguments, Failed To Exec Command
 */
const executeCommand = async (command, cwd) => {
  if(!isString(command) || !command.trim()) throw new Error('Invalid Command Argument');
  if(!isString(cwd)     || !cwd    .trim()) throw new Error('Invalid Cwd Argument');
  
  const rawResult = await execAsync(command, {
    shell: '/bin/bash',
    cwd  : cwd
  });
  const result = {
    stdout: rawResult.stdout.trim(),
    stderr: rawResult.stderr.trim()
  };
  if(result.stderr) throw result;
  return result;
};


// Functions
// ================================================================================

/**
 * Create GitHub Repository
 * 
 * @param {string} repositoryName Repository Name
 * @param {string} description Description
 * @throws When Unknown Request Error Occurred
 */
const createGitHubRepository = async (repositoryName, description) => {
  console.log('Create GitHub Repository...');
  
  if(!ghToken) return console.log('  GitHub Token Is Not Defined, Skip');
  
  const createRepoRawResponse = await request('https://api.github.com/user/repos', {  // https://docs.github.com/ja/rest/repos/repos#create-a-repository-for-the-authenticated-user
    method: 'POST',
    headers: baseHeaders
  }, JSON.stringify({
    name            : repositoryName,
    description     : description,
    homepage        : 'https://neos21.net/',
    license_template: 'mit',  // https://docs.github.com/ja/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository#searching-github-by-license-type
    private         : false
  }));
  const createRepoResult = JSON.parse(createRepoRawResponse.data);
  
  console.log(createRepoResult);
  console.log('  Executed');
};

/**
 * Git Clone
 * 
 * @param {string} repositoryName Repository Name
 * @param {string} ghRootDirectoryPath GitHub Root Directory Path
 * @param {string} ghRepoDirectoryPath GitHub Repo Directory Path
 * @return {Promise<boolean>} `true` If succeeded, Otherwise `false` to abort
 * @throws Failed To Execute Command
 */
const gitClone = async (repositoryName, ghRootDirectoryPath, ghRepoDirectoryPath) => {
  console.log('Git Clone...');
  
  if(await isFileExist(ghRepoDirectoryPath)) {
    console.log('  GitHub Repo Directory Is Already Exist, Skip');
    return true;
  }
  
  if(await readText('  Clone Repo?') !== 'y') {
    console.log('  Aborted');
    return false;
  }
  
  try {
    await executeCommand(`git clone 'https://Neos21@github.com/Neos21/${repositoryName}.git'`, ghRootDirectoryPath);
  }
  catch(error) {
    if(error.stdout !== '' || error.stderr !== `Cloning into '${repositoryName}'...`) throw error;  // That StdErr Is No Problem
  }
  
  if(!await isFileExist(ghRepoDirectoryPath)) throw new Error('GitHub Repository Does Not Exist. Something Wrong To Clone Repository');
  
  console.log('  Git Clone Succeeded');
  return true;
};

/**
 * Change Git Config
 * 
 * @param {string} ghRepoDirectoryPath GitHub Repo Directory Path
 * @throws Failed To Execute Command
 */
const changeGitConfig = async ghRepoDirectoryPath => {
  console.log('Change Git Config...');
  
  if(await readText('  Change Git Config?') !== 'y') return console.log('  Skipped');
  
  await executeCommand("git config user.name 'Neos21'"             , ghRepoDirectoryPath);
  await executeCommand("git config user.email 'neos21@gmail.com'"  , ghRepoDirectoryPath);
  const result = await executeCommand("git config --local --list | grep -e 'user'", ghRepoDirectoryPath);
  
  console.log(result.stdout.split('\n').map(line => `  ${line}`).join('\n'));  // Indent
  console.log('  Change Git Config Succeeded');
};

/** @type {Array<{ fileName: string; content: string; subDirectory: string | undefined; }>} Template File Definitions */
const templateFiles = [
  {
    fileName: '.gitignore',
    content: `.DS_Store
Thumbs.db

node_modules/
`
  },
  {
    fileName: 'README.md',
    content: `# __DESCRIPTION__

__DESCRIPTION__


## Links

- [Neo's World](https://neos21.net/)
`
  },
  {
    subDirectory: '.github',
    fileName: 'FUNDING.yml',
    content: `github: Neos21
custom:
  - 'https://neos21.net/'
`
  },
  {
    fileName: 'package.json',
    content: `{
  "name": "__REPOSITORY_NAME__",
  "description": "__DESCRIPTION__",
  "private": true,
  "scripts": {
    "start": "node ./index.js"
  },
  "author": "Neo <neos21@gmail.com> (https://neos21.net/)",
  "license": "MIT",
  "homepage": "https://github.com/Neos21/__REPOSITORY_NAME__#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Neos21/__REPOSITORY_NAME__.git"
  },
  "bugs": {
    "url": "https://github.com/Neos21/__REPOSITORY_NAME__/issues"
  },
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/Neos21"
  }
}
`
  },
  {
    fileName: '.nojekyll',
    content: ''
  }
];

/**
 * Create Template File
 * 
 * @param {{ fileName: string; content: string; subDirectory: string | undefined; }} templateFile Template File Definition
 * @param {string} ghRepoDirectoryPath GitHub Repo Directory Path
 * @param {string} repositoryName Repository Name
 * @param {string} description Description
 * @throws Failed To Process File
 */
const createTemplateFile = async (templateFile, ghRepoDirectoryPath, repositoryName, description) => {
  const { fileName, content, subDirectory } = templateFile;
  
  const fileRelativePath = path.join(subDirectory ?? '', fileName);
  const confirmMessage = await isFileExist(path.resolve(ghRepoDirectoryPath, fileRelativePath))
    ? `The File [${fileRelativePath}] Is Already Exist. Overwrite It?`
    : `Create [${fileRelativePath}]?`;
  if(await readText(confirmMessage) !== 'y') return console.log('  Cancelled');
  
  const replacedContent = content
    .replace((/__REPOSITORY_NAME__/g), repositoryName)
    .replace((/__DESCRIPTION__/g    ), description   );
  
  if(subDirectory) {
    await fs.mkdir(path.resolve(ghRepoDirectoryPath, subDirectory), { recursive: true });
    await fs.writeFile(path.resolve(ghRepoDirectoryPath, subDirectory, fileName), replacedContent, 'utf-8');
  }
  else {
    await fs.writeFile(path.resolve(ghRepoDirectoryPath, fileName), replacedContent, 'utf-8');
  }
  
  console.log('  Create Template File Succeeded');
};


// Main
// ================================================================================

(async () => {
  try {
    console.log('');
    console.log('+------------------------------------------------+');
    console.log('|     Create GitHub Repository And Templates     |');
    console.log('+------------------------------------------------+');
    console.log('');
    
    // Arguments
    if(process.argv.length < 4) return console.error('Please Input Arguments :\n  <Repo Name> <Description> [GH Root Dir] [GH Repo Dir]\n  (Environment Variable GH_TOKEN)');
    const repositoryName      = process.argv[2].trim();
    const description         = process.argv[3].trim();
    const ghRootDirectoryPath = process.argv[4] ? path.resolve(process.argv[4]) : path.resolve(process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], 'Documents/Dev/GitHub');
    const ghRepoDirectoryPath = path.resolve(ghRootDirectoryPath, process.argv[5] ?? repositoryName);
    
    // Settings
    console.log('Settings :');
    console.log(`  GitHub Token   : ${ghToken ?? '(None)'}`);
    console.log(`  Repo Name      : ${repositoryName}`);
    console.log(`  Description    : ${description}`);
    console.log(`  Root Directory : ${ghRootDirectoryPath}`);
    console.log(`  Repo Directory : ${ghRepoDirectoryPath}`);
    
    // Confirm
    console.log('');
    if(await readText('Start?') !== 'y') return console.log('  Cancelled');
    
    // Create GitHub Repository
    console.log('');
    await createGitHubRepository(repositoryName, description);
    
    // Git Clone
    console.log('');
    if(!await gitClone(repositoryName, ghRootDirectoryPath, ghRepoDirectoryPath)) return;  // Aborted
    
    // Change Git Config
    console.log('');
    await changeGitConfig(ghRepoDirectoryPath);
    
    // Create Template Files
    for(const templateFile of templateFiles) {
      console.log('');
      await createTemplateFile(templateFile, ghRepoDirectoryPath, repositoryName, description);
    }
    
    console.log('\nFinished! :');
    console.log(`  ${ghRepoDirectoryPath}`);
  }
  catch(error) {
    console.error('\nError :');
    console.error(error);
  }
})();
