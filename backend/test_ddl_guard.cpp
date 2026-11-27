#include "abstract_syntax_tree.h"
#include "clauses/create_clause.h"
#include "clauses/drop_clause.h"
#include "sql_guard.h"
#include <iostream>
#include <nlohmann/json.hpp>
#include <pg_query.h>
#include <string>

static int failures = 0;

static void expect(bool cond, const std::string &message)
{
    if (!cond)
    {
        std::cerr << "FAIL " << message << "\n";
        failures++;
    }
}

static std::shared_ptr<AbstractSyntaxTree::Node> statement(const std::string &sql)
{
    PgQueryParseResult result = pg_query_parse(sql.c_str());
    if (result.error)
    {
        std::cerr << "parse error: " << result.error->message << " for " << sql << "\n";
        pg_query_free_parse_result(result);
        std::exit(1);
    }
    auto tree = nlohmann::json::parse(result.parse_tree);
    pg_query_free_parse_result(result);
    AbstractSyntaxTree ast;
    auto root = std::make_shared<AbstractSyntaxTree::Node>("root", "");
    ast.build_tree(tree, root);
    return ast.get_statement_node(root);
}

int main()
{
    auto v20 = Create_clause::get_info(statement("CREATE TABLE t (name varchar(20));"));
    auto v40 = Create_clause::get_info(statement("CREATE TABLE t (name varchar(40));"));
    auto text = Create_clause::get_info(statement("CREATE TABLE t (tags text);"));
    auto arr = Create_clause::get_info(statement("CREATE TABLE t (tags text[]);"));
    auto with_default = Create_clause::get_info(statement("CREATE TABLE t (name text default 'x');"));
    auto no_default = Create_clause::get_info(statement("CREATE TABLE t (name text);"));
    expect(!v20.columns.empty() && v20.columns[0].type.find("20") != std::string::npos, "varchar(20) keeps length, got " + (v20.columns.empty() ? "" : v20.columns[0].type));
    expect(!Create_clause::compare(v20, v40).equal, "varchar(20) must not match varchar(40)");
    expect(!Create_clause::compare(text, arr).equal, "text must not match text[]");
    expect(with_default.columns[0].has_default, "DEFAULT is noticed");
    expect(!Create_clause::compare(with_default, no_default).equal, "missing DEFAULT is not certified");

    auto drop_room = Drop_clause::get_info(statement("DROP TABLE room;"));
    auto drop_other = Drop_clause::get_info(statement("DROP TABLE lamp;"));
    auto drop_none = Drop_clause::get_info(statement("SELECT 1;"));
    expect(drop_room.supported && drop_room.object_name == "room", "DROP TABLE room is a supported table drop");
    expect(!Drop_clause::compare(drop_room, drop_other).equal, "dropping the wrong table fails");
    expect(!Drop_clause::compare(drop_room, drop_none).equal, "a statement that drops nothing fails");

    expect(guard_student_sql("CREATE TABLE room (name text);", "sjob").allowed, "plain CREATE is allowed");
    expect(guard_student_sql("SELECT name FROM room;", "sjob").allowed, "plain SELECT is allowed");
    expect(guard_student_sql("DROP TABLE room;", "sjob").allowed, "plain DROP is allowed");
    expect(!guard_student_sql("DROP TABLE public.victim;", "sjob").allowed, "qualified DROP is rejected");
    expect(!guard_student_sql("CREATE TABLE public.t (id int);", "sjob").allowed, "qualified CREATE is rejected");
    expect(!guard_student_sql("SELECT * FROM public.room;", "sjob").allowed, "qualified SELECT is rejected");
    expect(!guard_student_sql("SELECT 1; DROP TABLE public.victim;", "sjob").allowed, "multistatement escape is rejected");
    expect(!guard_student_sql("SET search_path TO public;", "sjob").allowed, "SET is rejected");
    expect(!guard_student_sql("CREATE EXTENSION dblink;", "sjob").allowed, "CREATE EXTENSION is rejected");
    expect(!guard_student_sql("COPY t TO '/tmp/x';", "sjob").allowed, "COPY is rejected");
    expect(!guard_student_sql("CREATE FUNCTION f() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;", "sjob").allowed, "CREATE FUNCTION is rejected");

    if (failures)
    {
        std::cerr << failures << " failure(s)\n";
        return 1;
    }
    std::cout << "ddl guard tests passed\n";
    return 0;
}
