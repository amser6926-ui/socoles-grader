#include "drop_clause.h"
#include "common.h"
#include <vector>

namespace
{
    void collect_strings(const std::shared_ptr<AbstractSyntaxTree::Node> &node, std::vector<std::string> &out)
    {
        if (!node)
            return;
        if (node->key == "sval" && !node->value.empty())
            out.push_back(Common::strip_quotes(node->value));
        for (const auto &child : node->children)
            collect_strings(child, out);
    }
}

Drop_clause::drop_clause_info Drop_clause::get_info(const std::shared_ptr<AbstractSyntaxTree::Node> &node)
{
    drop_clause_info info;
    if (!node)
        return info;
    info.object_type = Common::strip_quotes(node->get_value("removeType"));
    info.missing_ok = Common::strip_quotes(node->get_value("missing_ok")) == "true";
    std::string behavior = Common::strip_quotes(node->get_value("behavior"));
    info.cascade = behavior.find("CASCADE") != std::string::npos;
    info.supported = info.object_type == "OBJECT_TABLE" || info.object_type == "OBJECT_VIEW";
    std::vector<std::string> names;
    collect_strings(node->get_child("objects"), names);
    if (names.size() >= 2)
    {
        info.schema_name = names[names.size() - 2];
        info.object_name = names.back();
    }
    else if (!names.empty())
    {
        info.object_name = names.back();
    }
    return info;
}

Common::comparision_result Drop_clause::compare(const drop_clause_info &reference, const drop_clause_info &other)
{
    Common::comparision_result result;
    result.equal = true;
    if (!reference.supported || !other.supported || reference.object_name.empty())
    {
        result.equal = false;
        result.incorrect_parts.push_back("DROP target");
        result.message = "DROP is graded only when it names a table or a view.\n";
        result.next_steps.push_back("Drop the named table.");
        return result;
    }
    if (reference.object_name == other.object_name)
        result.correct_parts.push_back("Dropped relation");
    else
    {
        result.equal = false;
        result.incorrect_parts.push_back("Dropped relation");
        result.message += "The statement should drop '" + reference.object_name + "', but it drops '" + other.object_name + "'.\n";
        result.next_steps.push_back("Drop '" + reference.object_name + "'.");
    }
    if (reference.schema_name != other.schema_name)
    {
        result.equal = false;
        result.incorrect_parts.push_back("Schema of DROP");
        result.message += "DROP must not name a different schema.\n";
        result.next_steps.push_back("Do not qualify the table with another schema.");
    }
    if (reference.missing_ok != other.missing_ok || reference.cascade != other.cascade)
    {
        result.equal = false;
        result.incorrect_parts.push_back("DROP options");
        result.message += "IF EXISTS or CASCADE does not match the reference.\n";
        result.next_steps.push_back("Match IF EXISTS and CASCADE from the reference.");
    }
    return result;
}
