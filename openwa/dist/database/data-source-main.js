"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const load_cli_env_1 = require("./load-cli-env");
(0, load_cli_env_1.loadCliEnv)();
const mainDataSource = new typeorm_1.DataSource({
    type: 'sqlite',
    database: './data/main.sqlite',
    entities: [__dirname + '/../modules/auth/**/*.entity{.ts,.js}', __dirname + '/../modules/audit/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations-main/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.DATABASE_LOGGING === 'true',
});
exports.default = mainDataSource;
//# sourceMappingURL=data-source-main.js.map