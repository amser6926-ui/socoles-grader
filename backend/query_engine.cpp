#include "query_engine.h"
#include <cctype>
#include <cstdlib>
#include <fstream>
#include <random>
#include <sstream>
#include <stdexcept>

namespace
{
    std::string quote_libpq(const std::string &value)
    {
        std::string out = "'";
        for (char c : value)
        {
            if (c == '\\' || c == '\'')
                out.push_back('\\');
            out.push_back(c);
        }
        out.push_back('\'');
        return out;
    }

    std::string quote_sql(const std::string &value)
    {
        std::string out = "'";
        for (char c : value)
        {
            if (c == '\'')
                out.push_back('\'');
            out.push_back(c);
        }
        out.push_back('\'');
        return out;
    }

    bool truthy(const std::string &value)
    {
        return value == "t" || value == "true" || value == "TRUE";
    }

    std::string random_token(int length)
    {
        static const char alphabet[] = "abcdefghijklmnopqrstuvwxyz0123456789";
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<int> pick(0, 35);
        std::string out;
        out.reserve(length);
        for (int i = 0; i < length; ++i)
            out.push_back(alphabet[pick(gen)]);
        return out;
    }
}

Query_Engine::Query_Engine(const Admin::database_options &opts)
    : opts_(opts), use_pg_(opts.use_postgresql)
{
    if (use_pg_)
    {
        if (opts_.is_front_end)
        {
            const char *host = std::getenv("PGHOST");
            const char *port = std::getenv("PGPORT");
            const char *user = std::getenv("GRADER_RUNNER_USER");
            const char *password = std::getenv("GRADER_RUNNER_PASSWORD");
            if (!user || !*user || !password || !*password)
                throw std::runtime_error("sandbox unavailable: GRADER_RUNNER_USER and GRADER_RUNNER_PASSWORD are required");
            if (host && *host)
                host_ = host;
            if (port && *port)
                port_ = port;
            provisioner_ = std::make_unique<MyPostgres>(conninfo_for(user, password));
        }
        else
        {
            pg_ = std::make_unique<MyPostgres>("dbname=" + opts_.postgresql_dbname);
        }
    }
    else if (!opts_.is_front_end)
    {
        duckdb_ = opts_.auto_db == 0 ? std::make_unique<MyDuckDB>(opts_.sql_file) : std::make_unique<MyDuckDB>(opts_.sql_create);
    }
    else
    {
        duckdb_ = std::make_unique<MyDuckDB>();
        job_schema_ = "main";
    }
}

Query_Engine::~Query_Engine()
{
    try
    {
        end_isolated_job();
    }
    catch (...)
    {
    }
}

std::string Query_Engine::conninfo_for(const std::string &user, const std::string &password) const
{
    std::string conninfo = "dbname=" + opts_.postgresql_dbname;
    if (!host_.empty())
        conninfo += " host=" + host_;
    if (!port_.empty())
        conninfo += " port=" + port_;
    conninfo += " user=" + user;
    conninfo += " password=" + quote_libpq(password);
    conninfo += " connect_timeout=5";
    return conninfo;
}

void Query_Engine::guard_or_throw(const std::string &sql) const
{
    if (job_schema_.empty())
        return;
    std::string trimmed = sql;
    while (!trimmed.empty() && std::isspace(static_cast<unsigned char>(trimmed.front())))
        trimmed.erase(trimmed.begin());
    if (trimmed.empty())
        return;
    SqlGuardResult guard = guard_student_sql(trimmed, job_schema_);
    if (!guard.allowed)
        throw std::runtime_error("sandbox rejected: " + guard.reason);
}

void Query_Engine::drop_job_role()
{
    if (job_schema_.empty() || job_schema_ == "main" || !provisioner_)
        return;
    const std::string ident = job_schema_;
    job_schema_.clear();
    job_password_.clear();
    pg_.reset();
    std::string err;
    provisioner_->execute_query_cud("SET ROLE \"" + ident + "\"", err);
    provisioner_->execute_query_cud("DROP SCHEMA IF EXISTS \"" + ident + "\" CASCADE", err);
    provisioner_->execute_query_cud("RESET ROLE", err);
    provisioner_->execute_query_cud("DROP OWNED BY \"" + ident + "\"", err);
    provisioner_->execute_query_cud("DROP ROLE IF EXISTS \"" + ident + "\"", err);
}

void Query_Engine::begin_isolated_job()
{
    if (!use_pg_ || !provisioner_)
        throw std::runtime_error("sandbox unavailable: postgres runner is not connected");
    std::string err;
    auto role = provisioner_->execute_query_select(
        "SELECT rolsuper::text, has_schema_privilege(current_user, 'public', 'CREATE')::text, rolcreaterole::text, current_database() "
        "FROM pg_roles WHERE rolname = current_user;",
        err);
    if (!err.empty() || role.empty() || role[0].size() < 4)
        throw std::runtime_error(std::string("sandbox unavailable: could not verify runner role") + (err.empty() ? "" : ": " + err));
    if (truthy(role[0][0]))
        throw std::runtime_error("sandbox unavailable: runner role is a superuser");
    if (truthy(role[0][1]))
        throw std::runtime_error("sandbox unavailable: runner can create objects in public");
    if (!truthy(role[0][2]))
        throw std::runtime_error("sandbox unavailable: runner cannot create a one-shot role");
    if (role[0][3] != opts_.postgresql_dbname)
        throw std::runtime_error("sandbox unavailable: runner is not connected to the grader database");

    job_schema_ = "s" + random_token(16);
    job_password_ = random_token(32);
    const std::string ident = job_schema_;
    const std::string db = opts_.postgresql_dbname;
    for (char c : db)
    {
        if (!std::isalnum(static_cast<unsigned char>(c)) && c != '_')
            throw std::runtime_error("sandbox unavailable: grader database name is not a plain identifier");
    }
    bool created = provisioner_->execute_query_cud(
                       "CREATE ROLE \"" + ident + "\" LOGIN PASSWORD " + quote_sql(job_password_) +
                           " NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
                       err) &&
                   provisioner_->execute_query_cud("GRANT \"" + ident + "\" TO CURRENT_USER", err) &&
                   provisioner_->execute_query_cud("GRANT CONNECT ON DATABASE \"" + db + "\" TO \"" + ident + "\"", err) &&
                   provisioner_->execute_query_cud("CREATE SCHEMA \"" + ident + "\" AUTHORIZATION \"" + ident + "\"", err);
    if (!created)
    {
        drop_job_role();
        throw std::runtime_error("sandbox unavailable: " + err);
    }
    try
    {
        pg_ = std::make_unique<MyPostgres>(conninfo_for(ident, job_password_));
    }
    catch (...)
    {
        drop_job_role();
        throw;
    }
    auto confined = pg_->execute_query_select(
        "SELECT rolsuper::text, has_schema_privilege(current_user, 'public', 'CREATE')::text, current_user, current_database() "
        "FROM pg_roles WHERE rolname = current_user;",
        err);
    if (!err.empty() || confined.empty() || confined[0].size() < 4 || truthy(confined[0][0]) || truthy(confined[0][1]) ||
        confined[0][2] != ident || confined[0][3] != db)
    {
        drop_job_role();
        throw std::runtime_error("sandbox unavailable: one-shot role is not confined");
    }
    if (!pg_->execute_query_cud("REVOKE ALL ON SCHEMA \"" + ident + "\" FROM PUBLIC", err) ||
        !pg_->execute_query_cud("SET search_path TO \"" + ident + "\"", err) ||
        !pg_->execute_query_cud("SET statement_timeout = '3000'", err))
    {
        drop_job_role();
        throw std::runtime_error("sandbox unavailable: " + err);
    }
}

void Query_Engine::end_isolated_job()
{
    if (job_schema_.empty() || job_schema_ == "main")
    {
        pg_.reset();
        return;
    }
    drop_job_role();
}

void Query_Engine::initialize()
{
    if (use_pg_)
    {
        if (opts_.is_front_end)
        {
            if (!pg_)
                throw std::runtime_error("sandbox unavailable: isolated job was not started");
            if (opts_.sql_create.empty())
                return;
            guard_or_throw(opts_.sql_create);
            std::string err;
            if (!pg_->execute_query_cud(opts_.sql_create, err))
                throw std::runtime_error("Pg init failed: " + err);
        }
        else
        {
            std::ifstream f(opts_.sql_file);
            if (!f.is_open())
                throw std::runtime_error("Cannot open " + opts_.sql_file);
            std::stringstream buf;
            buf << f.rdbuf();
            std::string sql = buf.str(), err;
            if (!pg_->execute_query_cud(sql, err))
                throw std::runtime_error("Pg init failed: " + err);
        }
    }
    else if (opts_.is_front_end)
    {
        std::string err;
        const std::string &sql = opts_.auto_db == 0 ? opts_.sql_file : opts_.sql_create;
        if (!sql.empty())
        {
            guard_or_throw(sql);
            if (!duckdb_->execute_query_cud(sql, err))
                throw std::runtime_error("DuckDB init failed: " + err);
        }
    }
}

std::vector<std::vector<std::string>>
Query_Engine::execute_select(const std::string &sql)
{
    guard_or_throw(sql);
    if (use_pg_ && !pg_)
        throw std::runtime_error("sandbox unavailable: isolated job was not started");
    std::string err;
    if (use_pg_)
        return pg_->execute_query_select(sql, err);
    return duckdb_->execute_query_select(sql, err);
}

std::vector<std::vector<std::string>>
Query_Engine::execute_non_select(const std::string &sql, std::string &error)
{
    guard_or_throw(sql);
    if (use_pg_ && !pg_)
        throw std::runtime_error("sandbox unavailable: isolated job was not started");
    if (use_pg_)
        return pg_->execute_query_not_select(sql, error);
    return duckdb_->execute_query_not_select(sql, error);
}

void Query_Engine::clear()
{
    if (use_pg_ && job_schema_.empty() && pg_)
        pg_->clear();
}
