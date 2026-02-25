import type { SupportedLanguage } from '@pleaseai/soop-utils/ast'
import type Parser from 'tree-sitter'
import type { InheritanceRelation } from './dependency-graph'
import { LANGUAGE_CONFIGS } from '@pleaseai/soop-utils/ast'
import { createLogger } from '@pleaseai/soop-utils/logger'

const log = createLogger('InheritanceExtractor')

/**
 * Extracts class inheritance and interface implementation relationships
 * from source code using tree-sitter AST parsing
 */
export class InheritanceExtractor {
  private parser: Parser | undefined

  /**
   * Get or create a Parser instance, lazy-loaded to avoid issues when tree-sitter isn't needed
   */
  private getParser(): Parser | undefined {
    if (!this.parser) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TreeSitter = require('tree-sitter')
        this.parser = new TreeSitter() as Parser
      }
      catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
          throw err
        }
        return undefined
      }
    }
    return this.parser
  }

  /**
   * Extract inheritance and implementation relationships from source code
   */
  extract(
    source: string,
    language: string,
    filePath: string,
  ): InheritanceRelation[] {
    const normalizedLanguage = this.normalizeLanguage(language)

    if (!normalizedLanguage || !(normalizedLanguage in LANGUAGE_CONFIGS)) {
      return []
    }

    if (!source.trim()) {
      return []
    }

    try {
      const parser = this.getParser()
      if (!parser) {
        return []
      }
      const config = LANGUAGE_CONFIGS[normalizedLanguage as SupportedLanguage]
      if (!config) {
        return []
      }
      parser.setLanguage(
        config.parser as Parameters<typeof parser.setLanguage>[0],
      )

      const tree = parser.parse(source)
      if (!tree.rootNode) {
        return []
      }

      const relations: InheritanceRelation[] = []
      this.extractFromNode(tree.rootNode, filePath, normalizedLanguage, relations)
      return relations
    }
    catch (err) {
      log.warn(`Failed to extract inheritance relations from ${filePath}: ${err}`)
      return []
    }
  }

  private normalizeLanguage(language: string): string {
    const aliases: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cs: 'csharp',
      rb: 'ruby',
      kt: 'kotlin',
      kts: 'kotlin',
      cc: 'cpp',
      cxx: 'cpp',
    }
    return aliases[language] ?? language
  }

  private extractFromNode(
    node: Parser.SyntaxNode,
    filePath: string,
    language: string,
    relations: InheritanceRelation[],
  ): void {
    if (language === 'typescript' || language === 'javascript') {
      this.extractFromTypeScript(node, filePath, relations)
    }
    else if (language === 'python') {
      this.extractFromPython(node, filePath, relations)
    }
    else if (language === 'java') {
      this.extractFromJava(node, filePath, relations)
    }
    else if (language === 'rust') {
      this.extractFromRust(node, filePath, relations)
    }
    else if (language === 'go') {
      this.extractFromGo(node, filePath, relations)
    }
    else if (language === 'csharp') {
      this.extractFromCSharp(node, filePath, relations)
    }
    else if (language === 'cpp') {
      this.extractFromCpp(node, filePath, relations)
    }
    else if (language === 'ruby') {
      this.extractFromRuby(node, filePath, relations)
    }
    else if (language === 'kotlin') {
      this.extractFromKotlin(node, filePath, relations)
    }
    // C has no class inheritance; skip

    for (const child of node.children) {
      this.extractFromNode(child, filePath, language, relations)
    }
  }

  /**
   * TypeScript/JavaScript: class_declaration → class_heritage → extends_clause / implements_clause
   */
  private extractFromTypeScript(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class_declaration') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    // Find class_heritage child which contains extends_clause and implements_clause
    const heritage = node.children.find(c => c.type === 'class_heritage')
    if (!heritage) {
      return
    }

    for (const clause of heritage.children) {
      if (clause.type === 'extends_clause') {
        this.extractExtendsClause(clause, childClass, filePath, relations)
      }
      else if (clause.type === 'implements_clause') {
        this.extractImplementsClause(clause, childClass, filePath, relations)
      }
    }
  }

  private extractExtendsClause(
    clause: Parser.SyntaxNode,
    childClass: string,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    for (const child of clause.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        relations.push({
          childFile: filePath,
          childClass,
          parentClass: child.text,
          kind: 'inherit',
        })
      }
    }
  }

  private extractImplementsClause(
    clause: Parser.SyntaxNode,
    childClass: string,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    for (const child of clause.children) {
      if (child.type === 'type_identifier') {
        relations.push({
          childFile: filePath,
          childClass,
          parentClass: child.text,
          kind: 'implement',
        })
      }
    }
  }

  /**
   * Python: class_definition → superclasses field (argument_list) → identifier children
   */
  private extractFromPython(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class_definition') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    const argList = node.childForFieldName('superclasses')
    if (!argList) {
      return
    }

    for (const child of argList.children) {
      if (child.type === 'identifier' || child.type === 'attribute') {
        relations.push({
          childFile: filePath,
          childClass,
          parentClass: child.text,
          kind: 'inherit',
        })
      }
    }
  }

  /**
   * Java: class_declaration → superclass field (contains type_identifier), super_interfaces child
   */
  private extractFromJava(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class_declaration') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    this.extractJavaSuperclass(node, childClass, filePath, relations)
    this.extractJavaSuperInterfaces(node, childClass, filePath, relations)
  }

  private extractJavaSuperclass(
    node: Parser.SyntaxNode,
    childClass: string,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    // superclass field returns the superclass node (e.g. "extends Animal")
    // Extract type_identifier within it
    const superclass = node.childForFieldName('superclass')
    if (!superclass) {
      return
    }
    for (const child of superclass.children) {
      if (child.type === 'type_identifier') {
        relations.push({
          childFile: filePath,
          childClass,
          parentClass: child.text,
          kind: 'inherit',
        })
      }
    }
  }

  private extractJavaSuperInterfaces(
    node: Parser.SyntaxNode,
    childClass: string,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    // super_interfaces is a child node (not a field), contains type_list → type_identifier
    for (const child of node.children) {
      if (child.type !== 'super_interfaces') {
        continue
      }
      for (const listChild of child.children) {
        if (listChild.type === 'type_list') {
          this.extractJavaTypeListInterfaces(listChild, childClass, filePath, relations)
        }
      }
    }
  }

  private extractJavaTypeListInterfaces(
    typeList: Parser.SyntaxNode,
    childClass: string,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    for (const typeChild of typeList.children) {
      if (typeChild.type === 'type_identifier') {
        relations.push({
          childFile: filePath,
          childClass,
          parentClass: typeChild.text,
          kind: 'implement',
        })
      }
    }
  }

  /**
   * Rust: impl_item → trait field + type field
   */
  private extractFromRust(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'impl_item') {
      return
    }

    const traitNode = node.childForFieldName('trait')
    const typeNode = node.childForFieldName('type')

    if (!traitNode || !typeNode) {
      return
    }

    relations.push({
      childFile: filePath,
      childClass: typeNode.text,
      parentClass: traitNode.text,
      kind: 'implement',
    })
  }

  /**
   * Go: type_declaration → type_spec child → struct_type → embedded field_declarations
   */
  private extractFromGo(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'type_declaration') {
      return
    }

    // type_spec is a child by type, not a field
    const typeSpec = node.children.find(c => c.type === 'type_spec')
    if (!typeSpec) {
      return
    }

    const childClass = typeSpec.childForFieldName('name')?.text
    if (!childClass) {
      return
    }

    const structType = typeSpec.childForFieldName('type')
    if (structType?.type !== 'struct_type') {
      return
    }

    this.extractGoEmbeddedStructs(structType, childClass, filePath, relations)
  }

  private extractGoEmbeddedStructs(
    structType: Parser.SyntaxNode,
    childClass: string,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    for (const child of structType.children) {
      if (child.type !== 'field_declaration_list') {
        continue
      }
      for (const fieldChild of child.children) {
        if (fieldChild.type === 'field_declaration' && !fieldChild.childForFieldName('name')) {
          const type = fieldChild.childForFieldName('type')
          if (type) {
            relations.push({
              childFile: filePath,
              childClass,
              parentClass: type.text,
              kind: 'inherit',
            })
          }
        }
      }
      break
    }
  }

  /**
   * C#: class_declaration / struct_declaration → base_list → base_type children
   * First base_type is treated as superclass (inherit), rest as interfaces (implement)
   */
  private extractFromCSharp(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class_declaration' && node.type !== 'struct_declaration') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    const baseList = node.children.find(c => c.type === 'base_list')
    if (!baseList) {
      return
    }

    const isStruct = node.type === 'struct_declaration'
    let isFirst = true
    for (const child of baseList.children) {
      if (child.type === 'base_type') {
        const typeNode = child.children.find(
          c => c.type === 'identifier' || c.type === 'qualified_name' || c.type === 'generic_name',
        )
        const parentClass = typeNode?.text ?? child.text
        if (parentClass) {
          relations.push({
            childFile: filePath,
            childClass,
            parentClass,
            kind: !isStruct && isFirst ? 'inherit' : 'implement',
          })
          isFirst = false
        }
      }
    }
  }

  /**
   * C++: class_specifier → base_class_clause → base_specifier → type_identifier children
   */
  private extractFromCpp(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class_specifier') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    const baseClause = node.children.find(c => c.type === 'base_class_clause')
    if (!baseClause) {
      return
    }

    for (const child of baseClause.children) {
      if (child.type === 'base_specifier') {
        const typeNode = child.children.find(
          c => c.type === 'type_identifier' || c.type === 'qualified_identifier',
        )
        if (typeNode) {
          relations.push({
            childFile: filePath,
            childClass,
            parentClass: typeNode.text,
            kind: 'inherit',
          })
        }
      }
    }
  }

  /**
   * Ruby: class node → superclass field → identifier / constant
   */
  private extractFromRuby(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    const superclass = node.childForFieldName('superclass')
    if (!superclass) {
      return
    }

    // superclass field may be a constant or scope_resolution
    const parentClass = superclass.text
    if (parentClass) {
      relations.push({
        childFile: filePath,
        childClass,
        parentClass,
        kind: 'inherit',
      })
    }
  }

  /**
   * Kotlin: class_declaration → delegation_specifiers → delegation_specifier children
   */
  private extractFromKotlin(
    node: Parser.SyntaxNode,
    filePath: string,
    relations: InheritanceRelation[],
  ): void {
    if (node.type !== 'class_declaration') {
      return
    }

    const childClass = this.getChildClassName(node)
    if (!childClass) {
      return
    }

    const delegationSpecs = node.children.find(c => c.type === 'delegation_specifiers')
    if (!delegationSpecs) {
      return
    }

    for (const spec of delegationSpecs.children) {
      if (spec.type === 'delegation_specifier') {
        const isSuperclass = spec.children.some(c => c.type === 'constructor_invocation')
        // user_type or constructor_invocation → type_identifier / user_type
        const typeNode = spec.children.find(
          c => c.type === 'user_type' || c.type === 'constructor_invocation',
        )
        const parentClass = typeNode?.text ?? spec.text
        if (parentClass) {
          relations.push({
            childFile: filePath,
            childClass,
            parentClass,
            kind: isSuperclass ? 'inherit' : 'implement',
          })
        }
      }
    }
  }

  private getChildClassName(node: Parser.SyntaxNode): string | null {
    const nameNode = node.childForFieldName('name')
    if (nameNode) {
      return nameNode.text
    }

    for (const child of node.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        return child.text
      }
    }

    return null
  }
}
