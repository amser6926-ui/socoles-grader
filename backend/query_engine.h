#ifndef QUERY_ENGINE_H
#define QUERY_ENGINE_H

#include <memory>
#include <string>
#include <vector>
#include "admin.h"
#include "my_duckdb.h"
#include "my_postgresql.h"
#include "sql_guard.h"

/// hides all DBMS-specifics behind these two calls
class Query_Engine
{
public:
    explicit Query_Engine(const Admin::database_options &opts);
    ~Query_Engine();
    /// load schema + initial data
    void initialize();

    /// run a SELECT-style query (no side-effects)
    std::vector<std::vector<std::string>>
    execute_select(const std::string &sql);

    /// run a DML/DDL query and return the “diff” rows
    std::vector<std::vector<std::string>>
    execute_non_select(const std::string &sql, std::string &error);

    /// Clears all public tables. Not used on the isolated front-end path.
    void clear();
    void begin_isolated_job();
    void end_isolated_job();

private:
    void guard_or_throw(const std::string &sql) const;
    std::string conninfo_for(const std::string &user, const std::string &password) const;
    void drop_job_role();
    Admin::database_options opts_;
    bool use_pg_;
    std::string host_;
    std::string port_;
    std::string job_schema_;
    std::string job_password_;
    std::unique_ptr<MyDuckDB> duckdb_;
    /// Executes student SQL. On the front-end path this is a one-shot role.
    std::unique_ptr<MyPostgres> pg_;
    /// Creates and destroys the one-shot role. Student SQL never uses it.
    std::unique_ptr<MyPostgres> provisioner_;
};

#endif // QUERY_ENGINE_H
