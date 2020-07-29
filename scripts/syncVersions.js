const fs = require('fs');
const glob = require('glob');

const JSON_INDENTATION_LEVEL = 4;

const {version} = require('../package.json');

syncVersions('projects/ng-dompurify');

function syncVersions(root) {
  glob(
    root + '/*(package.json|package-lock.json)',
    {
      ignore: '**/node_modules/**',
    },
    (_, files) => {
      files.forEach(file => {
        const packageJson = JSON.parse(fs.readFileSync(file));

        fs.writeFileSync(
          file,
          JSON.stringify(
            {
              ...packageJson,
              version,
            },
            null,
            JSON_INDENTATION_LEVEL,
          ),
        );
      });
    },
  );
}
