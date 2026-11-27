#ifndef DROP_CLAUSE_H
#define DROP_CLAUSE_H

#include <memory>
#include <string>
#include "../abstract_syntax_tree.h"
#include "common.h"

class Drop_clause
{
public:
    struct drop_clause_info
    {
        std::string object_type;
        std::string object_name;
        std::string schema_name;
        bool missing_ok = false;
        bool cascade = false;
        bool supported = false;
    };
    static drop_clause_info get_info(const std::shared_ptr<AbstractSyntaxTree::Node> &node);
    static Common::comparision_result compare(const drop_clause_info &reference, const drop_clause_info &other);
};

#endif
