"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
* @license
* Copyright Google Inc. All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.io/license
*/
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const ts = require("typescript");
const ast_utils_1 = require("../utility/ast-utils");
const change_1 = require("../utility/change");
const find_module_1 = require("../utility/find-module");
const parse_name_1 = require("../utility/parse-name");
const project_1 = require("../utility/project");
const validation_1 = require("../utility/validation");

const lazyRoute = options => {
  const route = `{
  path: '${options.name}',
  loadChildren: './${options.name}/${options.name}.module#${core_1.strings.classify(`${options.name}Module`)}'
}`;
  if (options.routes) {
    return ', ' + route;
  }
  return route;
};

function addDeclarationToNgModule(options) {
    return (host) => {
        if (!options.module) {
            return host;
        }
        const parts = options.module.split('.');
        parts[parts.length - 3] += '-routing';
        const modulePath = parts.join('.');
        const text = host.read(modulePath);
        if (text === null) {
            throw new schematics_1.SchematicsException(`File ${modulePath} does not exist.`);
        }
        const sourceText = text.toString('utf-8');
        const source = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);
        const importModulePath = core_1.normalize(`/${options.path}/`
            + (options.flat ? '' : core_1.strings.dasherize(options.name) + '/')
            + core_1.strings.dasherize(options.name)
            + '.module');
        const relativePath = find_module_1.buildRelativePath(modulePath, importModulePath);
        const changes = ast_utils_1.addImportToModule(source, modulePath, core_1.strings.classify(`${options.name}Module`), relativePath);
        const nodes = ast_utils_1.findNodes(source, ts.SyntaxKind.Identifier);
        const call = nodes.filter(n => n.text === 'forRoot' || n.text === 'forChild').pop();
        const routes = call.parent.parent.arguments[0];
        const definition = ast_utils_1.findNodes(source, ts.SyntaxKind.Identifier).filter(s => s.text === routes.text).shift();
        const arr = definition.parent.initializer;
        const pos = arr.getEnd() - 1;
        const recorder = host.beginUpdate(modulePath);
        recorder.insertLeft(pos, lazyRoute(options, arr.elements > 0));
        host.commitUpdate(recorder);
        return host;
    };
}

function default_1(options) {
    return (host) => {
        if (!options.project) {
            throw new schematics_1.SchematicsException('Option (project) is required.');
        }
        const project = project_1.getProject(host, options.project);
        if (options.path === undefined) {
            options.path = project_1.buildDefaultPath(project);
        }
        if (options.route) {
            options.route = find_module_1.findModuleFromOptions(host, options);
        }
        const parsedPath = parse_name_1.parseName(options.path, options.name);
        options.name = parsedPath.name;
        options.path = parsedPath.path;
        options.routing = true;
        options.module = find_module_1.findModuleFromOptions(host, options);
        options.selector = buildSelector(options, project.prefix);
        validation_1.validateName(options.name);
        validation_1.validateHtmlSelector(options.selector);

        const componentTemplateSource = schematics_1.apply(schematics_1.url('./files'), [
            options.spec ? schematics_1.noop() : schematics_1.filter(path => !path.endsWith('.spec.ts')),
            options.inlineStyle ? schematics_1.filter(path => !path.endsWith('.__styleext__')) : schematics_1.noop(),
            options.inlineTemplate ? schematics_1.filter(path => !path.endsWith('.html')) : schematics_1.noop(),
            schematics_1.template(Object.assign({}, core_1.strings, { 'if-flat': (s) => options.flat ? '' : s }, options)),
            schematics_1.move(parsedPath.path),
        ]);

        return schematics_1.chain([
            schematics_1.branchAndMerge(schematics_1.chain([
                addDeclarationToNgModule(options),
                schematics_1.mergeWith(componentTemplateSource),
            ])),
        ]);
    };
}

function buildSelector(options, projectPrefix) {
    let selector = core_1.strings.dasherize(options.name);
    if (options.prefix) {
        selector = `${options.prefix}-${selector}`;
    }
    else if (options.prefix === undefined && projectPrefix) {
        selector = `${projectPrefix}-${selector}`;
    }
    return selector;
}

exports.default = default_1;
