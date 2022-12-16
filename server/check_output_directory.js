/**
 *						  WHITEBOPHIR
 *********************************************************
 * @licstart  The following is the entire license notice for the 
 *	JavaScript code in this page.
 *
 * Copyright (C) 2013  Ophir LOJKINE
 *
 *
 * The JavaScript code in this page is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License (GNU GPL) as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.  The code is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 *
 * As additional permission under GNU GPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * @licend
 */
const fs = require("./fs_promises");
const path = require("path");
let os = require("os");

const { R_OK, W_OK } = fs.constants;

/**
 * Checks that the output directory is writeable
 * @param {string} directory
 * @returns {string?}
 */
async function get_error(directory) {
  if (!fs.existsSync(directory)) {
    return "does not exist";
  }
  if (!fs.statSync(directory).isDirectory()) {
    error = "exists, but is not a directory";
  }
  const { uid, gid } = os.userInfo();
  const tmpfile = path.join(directory, Math.random() + ".json");
  try {
    fs.writeFileSync(tmpfile, "{}");
    fs.unlinkSync(tmpfile);
  } catch (e) {
    return (
      "does not allow file creation and deletion. " +
      "Check the permissions of the directory, and if needed change them so that " +
      `user with UID ${uid} has access to them. This can be achieved by running the command: chown ${uid}:${gid} on the directory`
    );
  }
  const fileChecks = [];
  const files = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const elem of files) {
    if (/^board-(.*)\.json$/.test(elem.name)) {
      const elemPath = path.join(directory, elem.name);
      if (!elem.isFile())
        return `contains a board file named "${elemPath}" which is not a normal file`;
      fileChecks.push(
        fs.promises.access(elemPath, R_OK | W_OK).catch(function () {
          return elemPath;
        })
      );
    }
  }
  const errs = (await Promise.all(fileChecks)).filter(function (x) {
    return x;
  });
  if (errs.length > 0) {
    return (
      `contains the following board files that are not readable and writable by the current user: "` +
      errs.join('", "') +
      `". Please make all board files accessible with chown 1000:1000`
    );
  }
}

/**
 * Checks that the output directory is writeable,
 * and exits the current process with an error otherwise.
 * @param {string} directory
 */
function check_output_directory(directory) {
  get_error(directory).then(function (error) {
    if (error) {
      console.error(
        `The configured history directory in which boards are stored ${error}.` +
          `\nThe history directory can be configured with the environment variable HISTORY_DIR. ` +
          `It is currently set to "${directory}".`
      );
      process.exit(1);
    }
  });
}

module.exports = check_output_directory;
