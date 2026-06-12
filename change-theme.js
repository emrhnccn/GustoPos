
const fs = require('fs');
const path = require('path');

const directoryPaths = ['./src/components', './src/app'];

const replacements = {
  'slate-': 'zinc-',
  'indigo-': 'amber-',
  'purple-': 'orange-',
  'blue-': 'amber-',
  'bg-slate-950': 'bg-black', // Make the background true black for premium look
  'gradient-to-r from-indigo-600 to-purple-600': 'gradient-to-r from-amber-600 to-orange-600',
  'gradient-to-br from-indigo-900/50 via-purple-900/50 to-slate-900': 'gradient-to-br from-amber-900/30 via-orange-900/20 to-black',
  'bg-indigo-500/10': 'bg-amber-500/10',
  'shadow-indigo-500/20': 'shadow-amber-500/20',
  'shadow-indigo-500/25': 'shadow-amber-500/25',
  'border-indigo-500': 'border-amber-500',
  'text-indigo-400': 'text-amber-400',
  'text-indigo-300': 'text-amber-300',
  'text-indigo-200': 'text-amber-200',
  'text-indigo-500': 'text-amber-500',
};

function processDirectory(directoryPath) {
  const files = fs.readdirSync(directoryPath);
  for (const file of files) {
    const fullPath = path.join(directoryPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const [key, value] of Object.entries(replacements)) {
        if (content.includes(key)) {
          content = content.split(key).join(value);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

directoryPaths.forEach(processDirectory);
console.log('Theme replacement complete!');

