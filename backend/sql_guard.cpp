#include "sql_guard.h"
#include "abstract_syntax_tree.h"
#include "clauses/common.h"
#include "clauses/drop_clause.h"
#include <cctype>
#include <pg_query.h>
#include <nlohmann/json.hpp>
#include <set>
#include <vector>

namespace
{
    bool equals_ci(const std::string &a, const std::string &b)
    {
        if (a.size() != b.size())
            return false;
        for (size_t i = 0; i < a.size(); ++i)
            if (std::tolower(static_cast<unsigned char>(a[i])) != std::tolower(static_cast<unsigned char>(b[i])))
                return false;
        return true;
    }

    void collect_schemas(const std::shared_ptr<AbstractSyntaxTree::Node> &node, std::vector<std::string> &out)
    {
        if (!node)
            return;
        if (node->key == "schemaname" && !node->value.empty())
        {
            std::string name = Common::strip_quotes(node->value);
            if (!name.empty() && name != "null")
                out.push_back(name);
        }
        for (const auto &child : node->children)
            collect_schemas(child, out);
    }
}

SqlGuardResult guard_student_sql(const std::string &sql, const std::string &job_schema)
{
    SqlGuardResult result;
    if (sql.find('\0') != std::string::npos)
    {
        result.reason = "rejected statement";
        return result;
    }
    PgQueryParseResult parsed = pg_query_parse(sql.c_str());
    if (parsed.error)
    {
        result.reason = parsed.error->message ? parsed.error->message : "SQL did not parse";
        pg_query_free_parse_result(parsed);
        return result;
    }
    auto tree = nlohmann::json::parse(parsed.parse_tree, nullptr, false);
    pg_query_free_parse_result(parsed);
    if (tree.is_discarded())
    {
        result.reason = "SQL did not parse";
        return result;
    }
    AbstractSyntaxTree ast;
    auto root = std::make_shared<AbstractSyntaxTree::Node>("root", "");
    ast.build_tree(tree, root);
    auto statements = AbstractSyntaxTree::get_statements(root);
    if (statements.empty())
    {
        result.reason = "no statement";
        return result;
    }
    const std::set<std::string> allowed = {
        "SelectStmt", "InsertStmt", "UpdateStmt", "DeleteStmt",
        "CreateStmt", "AlterTableStmt", "ViewStmt", "DropStmt"};
    for (const auto &stmt : statements)
    {
        std::string type = AbstractSyntaxTree::get_statement_type(stmt);
        if (!allowed.count(type))
        {
            result.reason = "statement type is not allowed: " + type;
            return result;
        }
        if (type == "DropStmt")
        {
            auto node = ast.get_statement_node(stmt);
            auto info = Drop_clause::get_info(node);
            if (!info.supported)
            {
                result.reason = "DROP is allowed only for a table or a view";
                return result;
            }
            if (!info.schema_name.empty() && !equals_ci(info.schema_name, job_schema))
            {
                result.reason = "schema qualification outside the check schema is not allowed";
                return result;
            }
        }
        std::vector<std::string> schemas;
        collect_schemas(stmt, schemas);
        for (const auto &schema : schemas)
        {
            if (!equals_ci(schema, job_schema))
            {
                result.reason = "schema qualification outside the check schema is not allowed";
                return result;
            }
        }
    }
    result.allowed = true;
    return result;
}
