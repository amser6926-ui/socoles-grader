#ifndef SQL_GUARD_H
#define SQL_GUARD_H

#include <string>

struct SqlGuardResult
{
    bool allowed = false;
    std::string reason;
};

// Parse with libpg_query and allow only statements the grader understands.
// Any schema name other than job_schema is rejected. This is not a text regex.
SqlGuardResult guard_student_sql(const std::string &sql, const std::string &job_schema);

#endif
