import path from 'path';
import fs from 'fs';
import through from 'through2';
import glob from 'glob';
import slash from 'slash';
import minimatch from 'minimatch';

const IMPORT_RE = /^([ \t]*(?:\/\*.*)?)@import\s+["']([^"']+\*[^"']*(?:\.less)?)["'];?([ \t]*(?:\/[/*].*)?)$/gm;

export default function gulpLessGlob( options = {} ) {
  return through.obj( ( ...args ) => {
    transform( ...args, options );
  } );
}

function transform( file, env, callback, options = {} ) {
  const includePaths = options.includePaths || [];

  for ( let i = 0; i < includePaths.length; i++ ) {
    includePaths[ i ] = path.join( path.normalize( includePaths[ i ] ), '/' );
  }

  const isLess = path.extname( file.path ) === '.less';
  const base = path.normalize( path.join( path.dirname( file.path ), '/' ) );
  const ignorePaths = options.ignorePaths || [];

  const searchBases = [ base, ...includePaths ];
  let contents = file.contents.toString( 'utf-8' );
  let contentsCount = contents.split( '\n' )
    .length;

  let result;

  for ( let i = 0; i < contentsCount; i++ ) {
    result = IMPORT_RE.exec( contents );

    if ( result !== null ) {
      const [ importRule, startComment, globPattern, endComment ] = result;

      let files = [];
      let basePath;
      for ( let i = 0; i < searchBases.length; i++ ) {
        basePath = searchBases[ i ];

        files = glob.sync( path.join( basePath, globPattern ), {
          cwd: basePath
        } );

        if ( files.length > 0 ) {
          break;
        }
      }

      let imports = [];

      files.forEach( ( filename ) => {
        if ( filename !== file.path && isLessFunc( filename ) ) {
          // remove parent base path
          filename = path.normalize( filename )
            .replace( basePath, '' );
          if ( !ignorePaths.some( ignorePath => {
              return minimatch( filename, ignorePath );
            } ) ) {
            // remove parent base path
            imports.push( '@import "' + slash( filename ) + '"' + ';' );
          }
        }
      } );

      if ( startComment ) {
        imports.unshift( startComment );
      }

      if ( endComment ) {
        imports.push( endComment );
      }

      const replaceString = imports.join( '\n' );
      contents = contents.replace( importRule, replaceString );
      file.contents = new Buffer( contents );
    }
  }

  callback( null, file );
}

function isLessFunc( filename ) {
  return ( !fs.statSync( filename )
    .isDirectory() && path.extname( filename )
    .match( /\.less/i ) );
}
